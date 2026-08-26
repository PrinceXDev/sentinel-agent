# sentinel-agent

**Autonomous incident response, human-controlled execution.**

> Give the agent a production incident. It investigates it. It proves what happened. It prepares the fix. It refuses to touch production without you.

Built on [TrueForge](https://trueforge.dev), TrueFoundry's open-source agent harness, for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge).

---

## Build status

This is an in-progress hackathon build. What is done, verified, and what is not:

| Component                                                | Status                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| Ops MCP server — 10 tools, risk-classified and annotated | **Done.** 66 tests, annotations verified on the wire            |
| Seeded incident estate (deterministic fixtures)          | **Done.** Reproducible 3.7x regression                       |
| Agent spec — approval policy, sandbox, subagents         | **Done.** Cross-checked against the tool registry by test    |
| `incident-response` skill                                | **Done.** Awaiting registration (needs public repo URL)      |
| Architecture documentation                               | **Done** — [docs/architecture.md](docs/architecture.md)      |
| sentinel-agent UI (Next.js 16 + React 19)                | **Done.** Timeline, subagent threads, approval gate, audit   |
| End-to-end run against a live harness                    | **Blocked** on model + Daytona credentials                   |
| Qodo review trail                                        | **In progress.** PR #1 reviewed; 6 findings addressed        |
| Demo video                                               | **Not started**                                              |

Nothing below claims a capability that has not been exercised. Where something is unverified, it says so.

---

## The problem

When checkout latency triples, an engineer opens five tabs. Dashboards to see the shape of it. The deploy log to see what changed. GitHub to read the diff. A terminal to compute whether the change is big enough to matter. And then a decision — roll back or keep digging — made under time pressure with partial evidence.

The investigation is mechanical. The decision is not.

Most attempts to automate this go wrong in one of two directions. Either the tool only _reports_ — a dashboard summariser that leaves you exactly where you started — or it acts autonomously, and now an LLM's inference is wired directly to your production control plane.

## The solution

sentinel-agent does the mechanical part completely and stops at the decision.

It reaches real systems over MCP, delegates three parallel lines of investigation to subagents, writes and executes diagnostic code in an isolated sandbox to compute the magnitudes rather than estimate them, correlates the evidence into a root cause with a stated mechanism and a confidence number — and then **pauses**, holding the remediation until a human approves it.

The split is the product: **investigation is automated, execution is authorised.**

## Why TrueForge

Remove TrueForge and this project does not degrade — it stops existing.

| Capability                | What it carries                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------- |
| **MCP tool routing**      | Reaching the ops estate at all                                                     |
| **Approval gating**       | The entire safety model, enforced in the harness where sentinel-agent cannot bypass it   |
| **Sandbox orchestration** | Isolated Python on demand, with tool calls bridged back so no credential enters it |
| **Subagent delegation**   | Three investigation lines in parallel, isolated contexts, conclusions only         |
| **Session persistence**   | Surviving a reload mid-investigation                                               |
| **Context management**    | Compaction and large-response offloading, so 61 samples plus four diffs fit        |

The agent loop is the harness's. sentinel-agent contributes the domain, the safety classification, the methodology, and the view. See [docs/architecture.md](docs/architecture.md).

## The approval gate, and the bug it is built around

TrueForge derives approval gating entirely from MCP tool annotations:

```ts
// trueforge-core/src/core/mcp/toolSelectors.ts
function isDestructive(a?: ToolAnnotations) {
  return a?.destructiveHint === true;
}
function isWrite(a?: ToolAnnotations) {
  return a?.readOnlyHint === false && a.destructiveHint !== true;
}
```

**A tool that publishes no annotations matches no tag.** The default policy is `["@write", "@destructive"]`, so an unannotated tool matches nothing in it and **executes with no approval prompt at all**.

A `rollback_deployment` that forgot its annotations therefore fires straight at production, silently — and nothing in review looks wrong. The tool is correct. The agent config is correct. The gate just never triggers. The cookbook's own `bring-your-own-mcp` example publishes zero annotations, so copying it as a template is how you inherit this.

Three layers make it impossible here:

1. **Structural** — every tool is built through `defineTool`, which requires a `risk` class and derives annotations from it. No code path registers a tool without them.
2. **Tested** — [`registry.test.ts`](apps/mcp-server/src/tools/registry.test.ts) asserts against TrueForge's _own predicates_, not our labels: every tool annotated, annotations matching declared risk, every production-mutating tool named in the agent's approval list. Add a destructive tool without classifying it and CI fails.
3. **Belt and braces** — the agent spec names the destructive tools _literally_ as well as by tag, so the gate holds even if an SDK version drops annotations in transit.

Verified against `@modelcontextprotocol/sdk` 1.30.0 — 10/10 tools carry annotations into `tools/list`, zero unannotated.

## MCP tools

Read-only tools run autonomously. Anything that writes or destroys is gated — investigation should never need a click; remediation always should.

| Tool                      | Risk        | Tag            | Gated   |
| ------------------------- | ----------- | -------------- | ------- |
| `get_incident`            | read        | `@read-only`   | —       |
| `list_incidents`          | read        | `@read-only`   | —       |
| `get_service_health`      | read        | `@read-only`   | —       |
| `list_recent_deployments` | read        | `@read-only`   | —       |
| `get_deployment`          | read        | `@read-only`   | —       |
| `get_deployment_diff`     | read        | `@read-only`   | —       |
| `export_metrics_csv`      | read        | `@read-only`   | —       |
| `post_incident_note`      | write       | `@write`       | **yes** |
| `rollback_deployment`     | destructive | `@destructive` | **yes** |
| `restart_service`         | destructive | `@destructive` | **yes** |

`export_metrics_csv` deliberately returns **raw samples and no analysis**. The agent has to compute the change point and the ratio itself, in the sandbox. That is what makes sandbox execution load-bearing rather than decorative.

## Sandbox execution

The regression's magnitude is never handed to the agent. It exports 61 minute-resolution samples as CSV, writes them into the sandbox, and analyses them with pandas — split the series at the deploy timestamp, skip the ramp, compare settled baseline against settled plateau, and confirm the signals that should not have moved did not.

Generated code runs in a Daytona sandbox provisioned on demand. It holds no credentials: tool calls from sandbox code are bridged back to the harness, where the real keys live. Untrusted code cannot exfiltrate a key it never had.

Python 3.13, with `pandas`, `requests`, `pydantic`, `openpyxl` preinstalled. No Node runtime. 60 seconds per `exec` call.

## Subagents

Three investigation lines run concurrently:

- **`performance-investigator`** — characterise the symptom. Compute onset and magnitude from raw samples.
- **`deployment-investigator`** — enumerate every change in a generous window; rule candidates in or out on timing alone.
- **`code-investigator`** — read the diffs of timing-plausible candidates and assess mechanism.

The root agent correlates. That judgement is never delegated.

> **Honest limitation:** TrueForge has no way to _declare_ named subagents. `AgentSpec` has no subagent field, and `create_sub_agent({name, input, model})` takes a name the model invents and a brief the model writes. Subagents always inherit the root's full tool set, and nesting is forbidden.
>
> These three roles are specified in the agent's instructions and in the skill, and the model follows that convention. The harness does not enforce the names and does not guarantee the fan-out. This is a prompt-level pattern, not a declarative capability, and it is documented as such rather than implied to be more.

## Human approval

There is no approval endpoint in TrueForge, and no approval id.

1. The harness emits `tool.approval_required` with `{ thread_id, tool_calls: [{ id, source_event_id }] }`.
2. **That event carries no tool name and no arguments.** Rendering "Approve rollback of `dpl-4c21`?" requires keeping a `Map<eventId, event>` and joining back through `source_event_id` to the originating `model.message`. That index is mandatory.
3. Resolution is a _new turn_: `POST /sessions/{id}/turns` with `input: [{ type: 'user.tool_approval', thread_id, tool_call_id, approval: { status: 'allow' | 'deny' } }]`.
4. On reload, `GET /turns/{turn_id}` → `state.required_actions` recovers what is still pending.

Before any gated call the agent must state the action, target, evidence, expected effect, risk, reversibility, and confidence. The approver reads that and nothing else — the skill treats a thin case as a failure, because a reasonable approver will decline it.

## Local development

### Prerequisites

- **Node.js 22.14+** (TrueForge's floor; this repo is developed on 23.6)
- A **model provider API key** — OpenAI, Anthropic, Google Gemini, or any OpenAI-compatible endpoint
- A **Daytona API key** — required for the sandbox, and therefore for skills. Daytona is currently TrueForge's only sandbox provider.

### 1. Start the ops MCP server

```bash
npm install
npm run dev:mcp
```

Listens on `http://localhost:8940/mcp`, with a read-only estate view at `/estate/state`, `/estate/audit`, and `/estate/tools`.

### 2. Start the harness

```bash
npx @truefoundry/trueforge@latest
```

Opens at `http://localhost:8790`.

### 3. Configure the harness

In the TrueForge UI:

1. **Settings → Models** — add your provider and key.
2. **Settings → Sandbox providers** — add Daytona and its key.
3. **Settings → Connectors → Add MCP Server** — name it `sentinel-ops`, URL `http://localhost:8940/mcp`, no auth. The name must match the agent spec.
4. **Settings → Skills** — register this repository, `ref` your branch, `path` `skills/incident-response`.

### 4. Create the agent

Take [`agent/sentinel-agent.agent.json`](agent/sentinel-agent.agent.json), replace `REPLACE_WITH_YOUR_MODEL` with your configured model (`provider/model`, e.g. `anthropic/claude-sonnet-4-6`), and create the agent.

`require_approval_for_tools` is **API-only** — it cannot be set in the UI, so the agent must be created via the API or with this spec inline on the session.

### Verify the safety model

```bash
npm test
```

99 tests (66 MCP + 33 UI). The ones that matter are in `apps/mcp-server/src/tools/registry.test.ts`.

To confirm annotations reach the wire:

```bash
curl -s -X POST http://localhost:8940/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Scripts

| Command             | Does                                                  |
| ------------------- | ----------------------------------------------------- |
| `npm run dev:mcp`   | Ops MCP server, watch mode                            |
| `npm test`          | Full suite                                            |
| `npm run typecheck` | `tsc --noEmit`, strict + `exactOptionalPropertyTypes` |
| `npm run format`    | Prettier                                              |

## Environment variables

See [`.env.example`](.env.example). Only `OPS_MCP_PORT` and `TRUEFORGE_BASE_URL` matter; model, Daytona, and connector credentials are held by the harness and never by sentinel-agent.

## Security

- No credential reaches this repo, the sandbox, or the UI. All three live in the harness. See [docs/architecture.md § Credential boundaries](docs/architecture.md#credential-boundaries).
- `.env` is gitignored; `.env.example` carries no real values.
- Production-mutating tools are gated three ways (structural, tested, literal-name).
- The estate is simulated, so no real system is reachable from this repo — the tools and data are ours to connect, as the hackathon rules require.
- `npm audit`: **0 vulnerabilities.**

## Project structure

```
apps/mcp-server/       Ops MCP server
  src/domain/          Estate model, seeded fixtures, store + audit log
  src/lib/             Risk classification, SDK compat shims, logger
  src/tools/           Tool registry, split by risk class
apps/web/              sentinel-agent UI (not started)
agent/                 Agent spec
skills/                incident-response SKILL.md
docs/architecture.md   Architecture, decisions, and their costs
```

## Qodo Code Review Evidence

### Representative PR

[PR #1 — feat: initial sentinel-agent scaffold — MCP server, UI, and agent spec](https://github.com/PrinceXDev/sentinel-agent/pull/1)

### What Qodo found

Six findings — two High, four Medium. All six were legitimate; none were
dismissed. Two of them were holes in the project's central safety claim, which is
exactly the kind of thing that is invisible when you wrote the code yourself.

| # | Severity | Finding | What changed |
|---|---|---|---|
| 1 | **High** | Harness proxy attached the server-held bearer token for any caller, with no authorisation or CSRF protection — a page in another tab could approve a production rollback | `/tf/[...path]` refuses cross-origin mutations via `Sec-Fetch-Site`; `next dev` pinned to `127.0.0.1`; trust model documented |
| 2 | **High** | MCP server bound `0.0.0.0` and executed `/mcp` unauthenticated, so `rollback_deployment` was reachable directly — never passing through the harness, so never reaching the approval gate | Binds `127.0.0.1` by default; optional `OPS_MCP_TOKEN` bearer auth (constant-time compare); insecure posture logged at `error`; `/estate` CORS narrowed from `*` to known origins |
| 3 | Medium | Optimistic approval removal left no retry path if the submission failed, stranding a run the harness was still blocking on | Snapshot before mutating, restore on failure — skipped if the call has since completed, to avoid a duplicate 422 |
| 4 | Medium | `reset()` replaced state without invalidating the active stream, so a superseded run's events repopulated the fresh state | Generation token, incremented by `start()` and `reset()`; `consume` drops events from a stale generation |
| 5 | Medium | `deployAnchor()` returned the fixture constant, so after a rollback the agent's change-point anchor pointed at a deployment no longer live | Derived from the live deployment; three regression tests |
| 6 | Medium | `isEstateState()` validated only two top-level fields — `incidents: [null]` passed and crashed the render | Full leaf-level validation; 13 guard tests |

Finding 2 is the one worth dwelling on. This project's entire thesis is that
irreversible actions pause for a human — and the gate is enforced by the harness,
not by the MCP server. So the gate protects a *path*, not a *tool*: anything
reaching the MCP server directly never encounters it. Binding to all interfaces
therefore didn't weaken the safety model, it offered a way around it entirely.
See [docs/architecture.md § Trust model](docs/architecture.md#trust-model).

### Verification after the fixes

- 99 tests (66 MCP + 33 UI), up from 69 — every fix carries a regression test
- `biome ci` clean, typecheck clean under `strict`, `next build` clean, `npm audit` 0 vulnerabilities
- Both security fixes verified at runtime, not just in tests: `/mcp` returns 401 without a token and 200 with it; the server refuses LAN connections while loopback works; the proxy returns 403 for cross-site and `same-site` mutations and passes `same-origin` through

### Review process

Substantive changes go through pull requests reviewed by Qodo before merge.
High-severity findings are fixed rather than dismissed; the two here were both
real. Nothing in this section is a link to a review that did not happen.

## Known limitations

- **Daytona is TrueForge's only sandbox provider.** No local Docker alternative; a Daytona key is a hard requirement for sandbox and skills.
- **Skills load only from public `github.com` / `gitlab.com` URLs.** No private-repo credential field exists.
- **Subagent role names are prompt convention**, not enforced by the harness. See above.
- **The estate is simulated.** Real protocol traffic, fixture data. `/estate/audit` exists so the agent's account can be cross-checked against what actually changed.
- **No compaction or sandbox-command events exist** in TrueForge, so the UI cannot surface either directly.
- **Model behaviour is not deterministic.** The fixtures are fixed; the investigation path varies between runs.

## Future work

- sentinel-agent UI: timeline, subagent threads, evidence drawer, approval centre, audit trail
- Point the same tool surface at a real observability API — a credentials change, not an architecture change
- Multi-incident triage: rank concurrent incidents by blast radius before investigating
- Post-incident report generation from the session's evidence graph

## License

MIT — see [LICENSE](LICENSE).
