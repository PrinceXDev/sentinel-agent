# Demo recording script — ~3 minutes

Written against the actual flow verified working in the successful run
(session `01m0yrcsc7aa`, Aug 26): 26 tool calls, 3 subagents, sandbox `exec`,
two approval gates, verified recovery. Every beat below names a real UI
element that exists — nothing is staged or narrated over a mockup.

## Before recording — checklist

- [ ] All four background processes up: harness, ops MCP, UI, tunnel
      (`ss -ltn` in WSL should show `:8790 :8940 :3000`)
- [ ] **Restart the ops MCP server** right before recording, so the estate is
      back to its seeded state (`degraded`, `dpl-4c21` live). The estate is a
      single in-memory store with no reset endpoint yet — once someone
      approves the rollback, it stays "fixed" until the process restarts.
      Restarting `dev:mcp` re-seeds it in about a second.
- [ ] `doctor.mjs` shows all green (or only the `OPS_MCP_TOKEN` warning, which
      is expected locally)
- [ ] Browser window sized to at least 1440px wide — the two-pane layout is
      the one built for this, not the mobile stack
- [ ] Close anything else that might pop a notification mid-recording
- [ ] Do one silent dry run first. Model output is not deterministic — the
      exact wording of the agent's report will differ slightly between runs;
      the *structure* (root cause → evidence → gate → rollback → verify) is
      what's guaranteed by the skill.

## 0:00–0:15 — The problem (talk over the idle screen)

> "When checkout latency triples in production, someone has to figure out why,
> prove it, and fix it — usually under time pressure, jumping between a
> dashboard, the deploy log, and a terminal. sentinel-agent does the
> investigation and the proof. It does not do the fix without a human."

Show the idle UI: the incident brief at the top (`INC-2048`, `degraded ·
6/8 ready`, `dpl-4c21`), and the empty timeline's own tagline underneath —
"real tools · sandboxed code · subagents · human approval" — which is
literally the four things about to happen.

## 0:15–0:30 — Hand it the incident

Read the brief text on screen aloud, or just let it sit for a beat, then
click **Investigate**.

> "This is the exact incident the estate is seeded with. I'm not going to
> touch anything else — just watch what it does with it."

## 0:30–1:10 — Real tools, real delegation

The timeline starts filling. Let it run without narrating over every line —
this is the part that has to speak for itself. Call out, as they appear:

- **`TOOL` rows** — `get_incident`, `list_recent_deployments`,
  `get_deployment_diff` against `sentinel-ops`. *"Those are real MCP calls
  against a real server — not simulated in the frontend."*
- **`DISPATCH` rows** — `performance-investigator`, `deployment-investigator`,
  `code-investigator`. *"Three sub-agents, each with their own brief, running
  in parallel — that's TrueForge's delegation, not something I wrote."*
- **`TOOL` rows with `exec`** — click "show generated code and output" on one.
  *"This is the sandbox. The agent wrote this Python itself to compute the
  actual regression — not a number it read off a table."*

## 1:10–1:35 — The sub-agents report back

- **`REPORT` rows** as each sub-agent finishes.
- Point at the right-hand panel: **Subagents · 3/3**, each with its brief
  visible.

> "Each of those ran independently, in its own context, and only its
> conclusion came back to the root agent — that's what let three separate
> investigation threads happen without drowning it in raw tool output."

## 1:35–2:00 — The gate

The `GATE` row appears — **HUMAN APPROVAL REQUIRED**, amber, the one color in
the whole product that means this.

> "This is the moment the product exists for. It's finished investigating and
> it has a fix ready — but it stops here."

Read the card aloud: the tool (`rollback_deployment`), the arguments shown
verbatim, and the reason the agent wrote — the actual mechanism (`timeoutMs
250→30,000ms`, `retries 0→3`), not just "it deployed around the same time."

> "It's not asking me to trust a summary. These are the literal arguments
> it's about to send."

## 2:00–2:10 — Approve

Click **Approve**.

> "I'm choosing to approve this because the evidence is a real mechanism, not
> a correlation — but declining was just as available, and the agent would
> have stopped there instead."

## 2:10–2:40 — Verified, not assumed

- Timeline: `rollback_deployment` completes, `post_incident_note` gate
  appears (a second, lower-stakes approval — approve it too, or mention it in
  passing), then verification tool calls, then `DONE`.
- Incident brief header flips: `degraded` → **healthy · 8/8 ready**,
  live deployment → `dpl-4c20`.
- **Point at the right panel's "Estate audit" section** —
  `rollback_deployment · Rolled checkout-api back from dpl-4c21 to dpl-4c20 ·
  by sentinel-agent`.

> "That line isn't the agent's report — it's the estate's own independent
> log of what actually changed. If it had claimed a rollback it never
> performed, this would be empty. It isn't."

## 2:40–3:00 — Close

> "Real tools, a real sandbox, real delegation, and a real approval gate that
> held until I clicked it. Built on TrueForge — repo and the full Qodo review
> trail are public."

Cut to the closing card (repo URL, track names).

---

## If a take goes wrong

- **Model output drifts oddly** (e.g. no clean root cause) → not a UI bug,
  restart the MCP server and try again; model behavior isn't deterministic
  even though the fixture data is.
- **Sandbox `exec` errors** → confirm `python3.12-venv` is still installed in
  WSL (`python3.12 -m venv /tmp/t && rm -rf /tmp/t`); this exact bug happened
  once already this session.
- **402 credits error** → check the OpenRouter balance before recording, not
  during.
