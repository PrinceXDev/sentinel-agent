/**
 * The seeded incident series, reproduced for the docs charts.
 *
 * This is a faithful copy of `buildMetrics()` in
 * `apps/mcp-server/src/domain/fixtures.ts` — same constants, same deterministic
 * jitter hash, same window. It is copied rather than imported because
 * `@sentinel-agent/web` does not depend on the MCP server workspace, and the
 * docs must render without the ops server running at all.
 *
 * `incidentSeries.test.ts` pins the derived figures the docs quote — 3.70x,
 * 15.3x, flat throughput — so a change to the constants below fails the suite
 * rather than silently changing what the pages claim.
 */

export const SERVICE = 'checkout-api';
export const WINDOW_START = Date.parse('2026-08-25T14:30:00Z');
export const DEPLOY_AT = Date.parse('2026-08-25T15:02:00Z');
export const DETECTED_AT = Date.parse('2026-08-25T15:04:00Z');
export const WINDOW_MINUTES = 61;
export const RAMP_MINUTES = 4;
export const BASE_P95 = 178;
export const PLATEAU_P95 = 658;
export const CHECKOUT_BUDGET_MS = 400;

export type Sample = {
  ts: number;
  minute: number;
  p95: number;
  p50: number;
  errorRate: number;
  rps: number;
};

const jitter = (index: number, salt: number): number => {
  let h = (index * 2654435761 + salt * 40503) | 0;
  h ^= h >>> 15;
  h = (h * 2246822519) | 0;
  h ^= h >>> 13;
  h = (h * 3266489917) | 0;
  h ^= h >>> 16;
  return (h & 0xffff) / 0x8000 - 1;
};

const round = (value: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
};

export const buildSeries = (): Sample[] => {
  const BASE_ERR = 0.004;
  const PLATEAU_ERR = 0.062;
  const samples: Sample[] = [];

  for (let i = 0; i < WINDOW_MINUTES; i += 1) {
    const ts = WINDOW_START + i * 60_000;
    const minutesSinceDeploy = (ts - DEPLOY_AT) / 60_000;
    const progress = minutesSinceDeploy < 0 ? 0 : Math.min(1, minutesSinceDeploy / RAMP_MINUTES);
    const eased = progress === 0 ? 0 : 1 - (1 - progress) ** 2;

    const p95 = BASE_P95 + (PLATEAU_P95 - BASE_P95) * eased + jitter(i, 1) * 6;
    const p50 = p95 * 0.34 + jitter(i, 2) * 3;
    const errorRate = BASE_ERR + (PLATEAU_ERR - BASE_ERR) * eased + jitter(i, 3) * 0.0009;
    const rps = 121 + jitter(i, 4) * 7;

    samples.push({
      ts,
      minute: i,
      p95: round(p95, 1),
      p50: round(p50, 1),
      errorRate: round(Math.max(0, errorRate), 5),
      rps: round(rps, 1),
    });
  }

  return samples;
};

/** Index of the first sample at or after the deploy. */
export const DEPLOY_INDEX = Math.round((DEPLOY_AT - WINDOW_START) / 60_000);

/**
 * The analysis the agent has to do in the sandbox: split at the deploy, skip the
 * ramp, and compare settled baseline against settled plateau. Exported so the
 * docs can state the ratio instead of hardcoding "3.7x" in prose.
 */
export const settledComparison = (samples: Sample[]) => {
  const before = samples.filter((s) => s.minute < DEPLOY_INDEX);
  const after = samples.filter((s) => s.minute >= DEPLOY_INDEX + RAMP_MINUTES);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const baselineP95 = mean(before.map((s) => s.p95));
  const plateauP95 = mean(after.map((s) => s.p95));
  const baselineErr = mean(before.map((s) => s.errorRate));
  const plateauErr = mean(after.map((s) => s.errorRate));
  const baselineRps = mean(before.map((s) => s.rps));
  const plateauRps = mean(after.map((s) => s.rps));

  return {
    baselineP95,
    plateauP95,
    ratio: plateauP95 / baselineP95,
    baselineErr,
    plateauErr,
    errRatio: plateauErr / baselineErr,
    baselineRps,
    plateauRps,
    rpsDelta: (plateauRps - baselineRps) / baselineRps,
    beforeCount: before.length,
    afterCount: after.length,
  };
};
