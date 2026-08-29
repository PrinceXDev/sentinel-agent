/** Verbatim code and diff excerpts quoted across the docs pages. */

/** dpl-4c21's actual diff, quoted on the guided tour. */
export const TOUR_INCIDENT_DIFF = `--- a/src/checkout/upstreamClient.ts
+++ b/src/checkout/upstreamClient.ts
@@ -10,10 +10,10 @@ import { taxProvider } from './providers/tax';

 export const upstreamClient = createClient({
   baseUrl: config.taxProviderUrl,
-  // Fail fast: the checkout path has a 400ms budget end to end.
-  timeoutMs: 250,
-  retries: 0,
+  // Tax provider has been flaky this week; be more patient with it.
+  timeoutMs: 30_000,
+  retries: 3,
   onError: (err) => logger.warn({ err }, 'tax provider call failed'),
 });`;

/**
 * TrueForge's own approval selectors, quoted verbatim from
 * `trueforge-core/src/core/mcp/toolSelectors.ts` — real third-party source,
 * not this project's style, so it keeps its original `function` declarations.
 */
export const APPROVAL_GATE_SELECTORS = `// trueforge-core/src/core/mcp/toolSelectors.ts
function isReadOnly(a?: ToolAnnotations) {
  return a?.readOnlyHint === true;
}
function isWrite(a?: ToolAnnotations) {
  return a?.readOnlyHint === false && a.destructiveHint !== true;
}
function isDestructive(a?: ToolAnnotations) {
  return a?.destructiveHint === true;
}`;

export const APPROVAL_GATE_DEFINE_TOOL = `// risk is required — there is no overload without it
defineTool({
  name: 'rollback_deployment',
  risk: 'destructive',        // ← derives the annotations below
  // readOnlyHint: false, destructiveHint: true
  ...
});`;

export const APPROVAL_GATE_EVENT_EXAMPLE = `{
  "type": "tool.approval_required",
  "thread_id": "thr_9f2a",
  "tool_calls": [
    { "id": "call_71c", "source_event_id": "evt_4410" }
  ]
}
// ↑ no tool name. no arguments. nothing to render.`;

export const APPROVAL_GATE_RESOLVE_EXAMPLE = `POST /api/v1/sessions/{session_id}/turns
{
  "input": [{
    "type": "user.tool_approval",
    "thread_id": "thr_9f2a",
    "tool_call_id": "call_71c",
    "approval": { "status": "allow" }   // or "deny"
  }]
}`;

/** The committed (partial) `reports/gate-conformance.json`. */
export const GATE_CONFORMANCE_REPORT = `{
  "generated_at": "2026-08-29T05:09:51.666Z",
  "harness": "http://localhost:8790",
  "model": "openrouter/claude-sonnet-4-5",
  "complete": false,
  "probes_run": ["P4"],
  "probes": [{
    "id": "P4",
    "route": "agent → sandbox code → rollback_deployment",
    "verdict": "route_not_exercised",
    "gated": false,
    "executed": false,
    "route_exercised": false,
    "target_approvals": [],
    "collateral_mutations": [],
    "session_id": "01m15yq6m8stgrd156s2d1mf08"
  }]
}`;

/** The pandas analysis the agent runs in the sandbox. */
export const SANDBOX_ANALYSIS_EXAMPLE = `import pandas as pd

df     = pd.read_csv("metrics.csv", parse_dates=["ts"])
deploy = pd.Timestamp("2026-08-25T15:02:00Z")

# 1. split at the change point
before = df[df.ts <  deploy]
# 2. skip the ramp — connection pools filling, retries piling up
after  = df[df.ts >= deploy + pd.Timedelta(minutes=4)]

# 3. compare settled to settled
p95_ratio = after.p95_latency_ms.mean() / before.p95_latency_ms.mean()
err_ratio = after.error_rate.mean()      / before.error_rate.mean()
rps_delta = after.rps.mean()             / before.rps.mean() - 1

print(f"p95 {p95_ratio:.2f}x  errors {err_ratio:.1f}x  throughput {rps_delta:+.1%}")
# p95 3.70x  errors 15.3x  throughput -0.1%`;
