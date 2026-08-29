import { describe, expect, it } from 'vitest';

import {
  BASE_P95,
  buildSeries,
  DEPLOY_INDEX,
  RAMP_MINUTES,
  settledComparison,
  WINDOW_MINUTES,
} from './incidentSeries';

/**
 * These assertions guard the numbers quoted in the marketing page and the docs.
 *
 * The prose says "3.70x", "15.3x" and "throughput flat". Those are not
 * hardcoded in the copy by hand — they are derived from this series — but a
 * change to the constants here would silently change what the pages claim. So
 * the claims are pinned.
 */
describe('incidentSeries', () => {
  const samples = buildSeries();

  it('produces the same 61-sample window the fixtures do', () => {
    expect(samples).toHaveLength(WINDOW_MINUTES);
    expect(DEPLOY_INDEX).toBe(32);
  });

  it('is deterministic across calls', () => {
    expect(buildSeries()).toEqual(samples);
  });

  it('is flat at the baseline until the deploy', () => {
    const before = samples.slice(0, DEPLOY_INDEX);
    for (const s of before) {
      // Baseline plus jitter of at most ±6ms.
      expect(Math.abs(s.p95 - BASE_P95)).toBeLessThanOrEqual(6);
    }
  });

  it('reaches the plateau after the ramp and stays there', () => {
    const after = samples.slice(DEPLOY_INDEX + RAMP_MINUTES);
    for (const s of after) {
      expect(s.p95).toBeGreaterThan(600);
    }
  });

  describe('the settled comparison the docs quote', () => {
    const stats = settledComparison(samples);

    it('splits 32 before and 25 after, discarding the ramp', () => {
      expect(stats.beforeCount).toBe(32);
      expect(stats.afterCount).toBe(25);
      expect(stats.beforeCount + stats.afterCount + RAMP_MINUTES).toBe(WINDOW_MINUTES);
    });

    it('reports a 3.70x p95 regression', () => {
      expect(stats.ratio.toFixed(2)).toBe('3.70');
    });

    it('reports a 15.3x error-rate increase', () => {
      expect(stats.errRatio.toFixed(1)).toBe('15.3');
    });

    it('reports throughput as unmoved — the fact that rules out a traffic surge', () => {
      expect(Math.abs(stats.rpsDelta)).toBeLessThan(0.01);
    });
  });
});
