# sentinel-agent — architecture

## What runs where

```
┌──────────────────────────────────────────────────────────────┐
│  sentinel-agent UI            React + TypeScript + Vite            │
│                                                              │
│  Renders the agent's execution as it happens: timeline,      │
│  subagent threads, sandbox runs, evidence, approval gate.    │
│  Holds no agent logic — it is a view over TrueForge events.  │
└───────────────────────────┬──────────────────────────────────┘
                            │  HTTP + SSE  (Vite proxies /tf → :8790)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  TRUEFORGE HARNESS                          localhost:8790   │
│                                                              │
│  Agent loop · tool routing · context management              │
│  Approval gating · subagent delegation · session persistence  │
│  Sandbox orchestration · model abstraction                   │
│                                                              │
│  Holds every credential. sentinel-agent holds none.                │
└──────┬───────────────────────┬──────────────────┬────────────┘
       │ MCP (streamable HTTP) │ create_sub_agent │ exec
       ▼                       ▼                  ▼
┌──────────────────┐   ┌───────────────┐   ┌─────────────────┐
│ sentinel-ops     │   │ Subagents     │   │ Daytona sandbox │
│ MCP server :8940 │   │ (dynamic)     │   │ Python 3.13     │
│                  │   │               │   │ pandas, numpy   │
│ 7 read-only      │   │ perf / deploy │   │                 │
│ 1 write   GATED  │   │ / code        │   │ Computes the    │
│ 2 destruct GATED │   │ investigators │   │ magnitudes      │
└────────┬─────────┘   └───────────────┘   └─────────────────┘
         │
         ▼
   Simulated production estate
   (incidents, deployments, diffs, golden signals)
```

## Why a harness is load-bearing here

Remove TrueForge and this project does not degrade — it stops existing. Six things it provides that would otherwise have to be built:

| Capability                | What sentinel-agent relies on it for                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Tool routing over MCP** | Reaching the ops estate at all. Tool discovery, schema handling, and call dispatch.                                          |
| **Approval gating**       | The entire safety model. Derived from MCP annotations, enforced in the harness — sentinel-agent cannot bypass it even by accident. |
| **Sandbox orchestration** | Provisioning an isolated Python environment on demand, and bridging tool calls back out so no credential enters it.          |
| **Subagent delegation**   | Running three investigation lines in parallel with isolated contexts, returning only conclusions.                            |
| **Session persistence**   | Surviving a page reload mid-investigation without losing the run.                                                            |
| **Context management**    | Compaction and large-tool-response offloading, so a 61-sample CSV plus four diffs does not blow the window.                  |

The agent loop itself — plan, call tools, observe, decide, pause, resume — is the harness's. sentinel-agent contributes the domain, the safety classification, the methodology, and the view.

## The approval gate

This is the part worth reading closely, because it is the part most likely to be built wrong.

### How TrueForge decides

Approval is derived from the MCP tool annotations the server publishes. From `trueforge-core/src/core/mcp/toolSelectors.ts`:

```ts
function isReadOnly(a?: ToolAnnotations) {
  return a?.readOnlyHint === true;
}
function isWrite(a?: ToolAnnotations) {
  return a?.readOnlyHint === false && a.destructiveHint !== true;
}
function isDestructive(a?: ToolAnnotations) {
  return a?.destructiveHint === true;
}
```

An agent's `require_approval_for_tools` defaults to `["@write", "@destructive"]`. Tools matching those tags pause; everything else runs autonomously.

### The failure mode this project is built around

**A tool that publishes no annotations matches no tag.** Not `@read-only`, not `@write`, not `@destructive`. Under the default policy it is therefore _exempt from approval_ and executes immediately.

So a `rollback_deployment` tool that forgot its annotations fires straight at production, with no prompt, and nothing in review looks wrong: the tool is correct, the agent config is correct, and the gate simply never triggers. The shipped `bring-your-own-mcp` cookbook example publishes zero annotations — copy it as a template and this is what you inherit.

Three layers guard against it here:

1. **Structural** — every tool is created through `defineTool`, which takes `risk: 'read' | 'write' | 'destructive'` as a _required_ field and derives annotations from it. There is no code path that registers a tool without them.
2. **Tested** — `src/tools/registry.test.ts` asserts, against TrueForge's own predicates rather than our labels, that every tool is annotated, that annotations match the declared risk, and that every production-mutating tool is named in the agent spec's approval list. Add a destructive tool without classifying it and the suite fails.
3. **Belt and braces** — the agent spec names `rollback_deployment` and `restart_service` _literally_ in `require_approval_for_tools`, alongside the tags. A literal name matches unconditionally, so the gate holds even if an SDK version drops annotations in transit.

Verified on the wire against `@modelcontextprotocol/sdk` 1.30.0 — all ten tools carry annotations into `tools/list`, zero unannotated.

### How approval resolves

There is no approval endpoint, and no approval id. The flow:

1. The harness emits **`tool.approval_required`** with `{ thread_id, tool_calls: [{ id, source_event_id }] }` and the turn ends in state `done` with `required_actions` populated.
2. **The event carries no tool name and no arguments.** To render "Approve rollback of dpl-4c21?" the client must keep a `Map<eventId, event>` of everything it has seen, follow `source_event_id` to the originating `model.message`, and find `toolCalls.find(tc => tc.id === ref.id)`. That index is mandatory, not an optimisation.
3. Resolution is a **new turn**: `POST /api/v1/sessions/{id}/turns` with `input: [{ type: 'user.tool_approval', thread_id, tool_call_id, approval: { status: 'allow' | 'deny' } }]`. One item per pending call. Approval items must never be mixed with user messages in the same turn — the harness returns 422.
4. On cold reload, `GET /turns/{turn_id}` → `state.required_actions` recovers anything still pending.

## Credential boundaries

| Secret                 | Held by                                  | Never reaches                   |
| ---------------------- | ---------------------------------------- | ------------------------------- |
| Model provider API key | TrueForge (Settings → Models)            | sentinel-agent, the sandbox, the repo |
| Daytona API key        | TrueForge (Settings → Sandbox providers) | sentinel-agent, the sandbox, the repo |
| MCP connector headers  | TrueForge (Settings → Connectors)        | sentinel-agent, the sandbox, the repo |

The sandbox never holds a credential: generated code calls tools through an in-sandbox client that bridges the call **back to the harness** over NATS, where the real credential lives. Untrusted generated code therefore cannot exfiltrate a key it never had.

`.env` in this repo carries exactly one setting of consequence — the port the ops MCP server listens on.

## Design decisions and their costs

**Simulated estate, real protocol.** The incidents, deployments, and metrics are fixtures. The MCP traffic against them is genuine JSON-RPC over streamable HTTP, and the approval gating is genuinely the harness's. Pointing the same tool surface at a real observability API is a credentials change, not an architecture change.

_Cost:_ a judge cannot verify the estate is real. Mitigated by `/estate/audit`, an independent record of every mutation that can be cross-checked against the agent's account, and by the fixtures being pure functions with a fixed seed — reproducible on any clone.

**Deterministic fixtures.** Every metric is generated by a seeded hash, so the 3.7x regression is byte-identical on every boot. The demo is reproducible, and the agent's conclusion is _earned_ from the data rather than read off a constant — nothing in the fixtures states which deployment is at fault.

_Cost:_ the agent's reasoning path still varies between runs, because the model is not deterministic. The data is fixed; the investigation is not.

**Subagent roles are prompt convention, not declaration.** TrueForge has no way to declare named subagents: `AgentSpec` has no subagent field, and `create_sub_agent({name, input, model})` takes a name the _model_ invents and a brief the _model_ writes. Subagents always inherit the root's full tool set, and nesting is forbidden.

So `performance-investigator`, `deployment-investigator`, and `code-investigator` are specified in the root agent's instructions and in the skill, and the model follows that convention. The harness does not enforce the names, cannot restrict tools per role, and does not guarantee the fan-out happens.

_Cost:_ this is a soft guarantee. Stated plainly here because the alternative — implying a declarative capability that does not exist — would be a misrepresentation. Hard guarantees would require three separately saved agents orchestrated from our own code, which trades the harness's parallel delegation for orchestration we would have to write and would weaken the "harness does the work" claim.

**Stateless MCP transport, stateful estate.** A fresh `McpServer` and transport per request, with no session id. Estate state lives in a process-wide store instead, because _that_ is what must persist — a rollback has to still be rolled back on the next call.

**The UI is a view, not a controller.** It holds no investigation logic and no workflow state machine. It renders TrueForge's event stream and posts approval decisions back. Anything resembling agent reasoning in the frontend would mean the harness was not doing the work.

## Repository layout

```
apps/
  mcp-server/          Ops MCP server — the systems sentinel-agent reaches
    src/
      domain/          Estate model, seeded fixtures, mutable store + audit log
      lib/             Risk classification, SDK compat shims, logger
      tools/           Tool registry, split by risk class
  web/                 sentinel-agent UI (React + Vite)
agent/
  sentinel-agent.agent.json  Agent spec: model, MCP wiring, approval policy, config
skills/
  incident-response/   SKILL.md — investigation methodology the agent follows
docs/
  architecture.md      This file
```

## Known limitations

- **Daytona is the only sandbox provider** TrueForge supports today (`SandboxProviderManifest.type` is `enum: ["daytona"]`), so a Daytona API key is a hard requirement for sandbox execution and for skills, which are cloned into the sandbox.
- **Skills load only from public `github.com` or `gitlab.com` URLs** — the manifest `url` pattern rejects anything else, and there is no credential field for private repos.
- **No compaction event exists**, so the UI cannot show when context was compacted.
- **No sandbox-command event exists** — sandbox `exec` calls surface as ordinary tool calls, which is how the UI renders them.
- **Subagents cannot ask the user anything.** Every approval gate is therefore at the root agent, by construction.
