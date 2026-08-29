/**
 * Deterministic metric-series generation, shared by every scenario.
 *
 * Extracted from `fixtures.ts` so a scenario declares the *shape* of its
 * telemetry — baseline, plateau, when the step happens, how long it ramps — and
 * gets a byte-identical series back on every boot. The jitter function is the
 * original one, unchanged, so the seeded checkout scenario produces exactly the
 * numbers it always has and the existing store tests still hold.
 *
 * Nothing in here knows what an incident is. A scenario supplies the numbers; the
 * agent has to work out what they mean.
 */

import type { MetricSample } from './types.js';

/**
 * Deterministic jitter in [-1, 1).
 *
 * A 32-bit integer hash of the sample index — chosen over `Math.random()` so the
 * series is stable across processes, and over a hand-written table so it still
 * looks like telemetry rather than a staircase.
 */
export const jitter = (index: number, salt: number): number => {
  let h = (index * 2654435761 + salt * 40503) | 0;
  h ^= h >>> 15;
  h = (h * 2246822519) | 0;
  h ^= h >>> 13;
  h = (h * 3266489917) | 0;
  h ^= h >>> 16;
  return (h & 0xffff) / 0x8000 - 1;
};

export const round = (value: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
};

/**
 * One step in a signal: it sits at `base`, and over `rampMinutes` after `atMs` it
 * eases to `to`. A signal with no step is flat for the whole window.
 */
export interface Step {
  readonly atMs: number;
  readonly to: number;
  readonly rampMinutes: number;
  /** When set, the signal returns to `base` this many minutes after `atMs`. */
  readonly recoversAfterMinutes?: number;
}

export interface SignalSpec {
  readonly base: number;
  readonly jitterAmplitude: number;
  readonly step?: Step;
}

export interface SeriesSpec {
  readonly startMs: number;
  readonly minutes: number;
  readonly p95: SignalSpec;
  readonly errorRate: SignalSpec;
  readonly rps: SignalSpec;
  /** p50 is derived from p95 by this ratio — a service's tail moves, its median often does not. */
  readonly p50Ratio: number;
  readonly p50JitterAmplitude: number;
  /**
   * When set, p50 gets its own independent spec instead of tracking p95.
   * Used by scenarios where the median moves with the tail (saturation) versus
   * ones where only the tail moves (a slow dependency behind a timeout).
   */
  readonly p50?: SignalSpec;
}

/** Value of one signal at a given timestamp, with its deterministic jitter applied. */
const signalAt = (spec: SignalSpec, index: number, salt: number, tsMs: number): number => {
  const noise = jitter(index, salt) * spec.jitterAmplitude;
  const { step } = spec;
  if (!step) return spec.base + noise;

  const minutesSince = (tsMs - step.atMs) / 60_000;
  if (minutesSince < 0) return spec.base + noise;

  const progress = Math.min(1, minutesSince / step.rampMinutes);
  // Ease-out, so a ramp reads as saturation rather than a straight line.
  const eased = progress === 0 ? 0 : 1 - (1 - progress) ** 2;
  let value = spec.base + (step.to - spec.base) * eased;

  // A transient: the signal comes back down on its own. This is what makes the
  // "insufficient evidence" scenario correct to leave alone — nothing needs
  // remediating, and a responder who rolls something back is wrong even though
  // the graph looked alarming for six minutes.
  if (step.recoversAfterMinutes !== undefined && minutesSince > step.recoversAfterMinutes) {
    const decay = Math.min(1, (minutesSince - step.recoversAfterMinutes) / step.rampMinutes);
    const decayEased = 1 - (1 - decay) ** 2;
    value = value + (spec.base - value) * decayEased;
  }

  return value + noise;
};

export const buildSeries = (spec: SeriesSpec): MetricSample[] => {
  const samples: MetricSample[] = [];

  for (let i = 0; i < spec.minutes; i += 1) {
    const ts = spec.startMs + i * 60_000;

    const p95 = signalAt(spec.p95, i, 1, ts);
    const p50 = spec.p50
      ? signalAt(spec.p50, i, 2, ts)
      : p95 * spec.p50Ratio + jitter(i, 2) * spec.p50JitterAmplitude;
    const errorRate = signalAt(spec.errorRate, i, 3, ts);
    const rps = signalAt(spec.rps, i, 4, ts);

    samples.push({
      ts: new Date(ts).toISOString(),
      p95_latency_ms: round(p95, 1),
      p50_latency_ms: round(p50, 1),
      error_rate: round(Math.max(0, errorRate), 5),
      rps: round(Math.max(0, rps), 1),
    });
  }

  return samples;
};
