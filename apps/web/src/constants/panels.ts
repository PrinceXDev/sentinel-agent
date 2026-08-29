/** Illustrative data for the marketing page's mock console panels (`components/site/mock/Panels.tsx`). */

export const MOCK_TIMELINE_EVENTS = [
  { t: '15:07:02', kind: 'tool', name: 'get_incident', arg: 'INC-2048', state: 'ok' },
  { t: '15:07:04', kind: 'tool', name: 'get_service_health', arg: 'checkout-api', state: 'ok' },
  {
    t: '15:07:06',
    kind: 'sub',
    name: 'performance-investigator',
    arg: 'characterise onset + magnitude',
    state: 'run',
  },
  {
    t: '15:07:06',
    kind: 'sub',
    name: 'deployment-investigator',
    arg: 'enumerate changes in window',
    state: 'run',
  },
  {
    t: '15:07:07',
    kind: 'sub',
    name: 'code-investigator',
    arg: 'read timing-plausible diffs',
    state: 'run',
  },
  { t: '15:07:19', kind: 'tool', name: 'export_metrics_csv', arg: '61 samples, raw', state: 'ok' },
  { t: '15:07:31', kind: 'sandbox', name: 'exec', arg: 'pandas, split at deploy', state: 'ok' },
  { t: '15:07:44', kind: 'gate', name: 'rollback_deployment', arg: 'dpl-4c21', state: 'gate' },
];

export const MOCK_TIMELINE_KIND_COLOR: Record<string, string> = {
  tool: 'var(--color-steel)',
  sub: 'var(--color-muted)',
  sandbox: 'var(--color-ok)',
  gate: 'var(--color-gate)',
};

export const MOCK_APPROVAL_BRIEF: [string, string][] = [
  ['Evidence', 'p95 178 → 658ms (3.70x) from 15:02; throughput flat; error rate 15.3x'],
  ['Mechanism', 'timeoutMs 250 → 30_000 with retries 0 → 3 on the tax provider call'],
  ['Expected effect', 'p95 returns to ~178ms within one rollout, about 90s'],
  ['Risk', 'Reverts a fix for a flaky provider; the flakiness returns'],
  ['Reversibility', 'Reversible — redeploy 2026.8.25-1'],
  ['Confidence', '0.91'],
];

export const MOCK_SANDBOX_CODE = [
  'import pandas as pd',
  '',
  'df = pd.read_csv("metrics.csv", parse_dates=["ts"])',
  'deploy = pd.Timestamp("2026-08-25T15:02:00Z")',
  '',
  'before = df[df.ts <  deploy]',
  'after  = df[df.ts >= deploy + pd.Timedelta(minutes=4)]   # skip the ramp',
  '',
  'print(before.p95_latency_ms.mean(),',
  '      after.p95_latency_ms.mean(),',
  '      after.p95_latency_ms.mean() / before.p95_latency_ms.mean())',
  'print(after.rps.mean() / before.rps.mean())',
].join('\n');

export const MOCK_DOCTOR_LINES: [string, string, 'ok' | 'warn'][] = [
  ['.env file', 'present', 'ok'],
  ['SENTINEL_MODEL', 'openrouter/claude-sonnet-4-5', 'ok'],
  ['SENTINEL_UI_TOKEN', 'set (48 chars)', 'ok'],
  ['ops MCP server', 'sentinel-ops v0.1.0 on http://127.0.0.1:8940', 'ok'],
  ['tool annotations', '10 tools, 0 unannotated, 3 approval-gated', 'ok'],
  ['harness', 'reachable at http://localhost:8790', 'ok'],
  ['model provider', 'openrouter', 'ok'],
  ['sandbox provider', 'none configured — local fallback active', 'warn'],
  ["connector 'sentinel-ops'", 'registered', 'ok'],
  ["skill 'incident-response'", 'registered', 'ok'],
];
