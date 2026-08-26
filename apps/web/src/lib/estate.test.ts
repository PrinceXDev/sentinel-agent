/**
 * Guard tests for the estate payload.
 *
 * `isEstateState` is the only thing standing between a drifted server response
 * and a crash mid-incident: the types in `estate.ts` are deliberately duplicated
 * from the MCP server rather than shared, so a shape change there does not fail
 * this app's typecheck. Whatever these tests do not cover, nothing does.
 *
 * Qodo flagged the original guard as accepting malformed data (Medium). It
 * checked only that `service` was a string and `incidents` was an array — so
 * `incidents: [null]` passed, and the incident header then read `.title` off
 * `null`. `live_deployment` and `health` were rendered directly and never
 * validated at all.
 */

import { describe, expect, it } from 'vitest';

import { isEstateState } from './estate';

const deployment = {
  id: 'dpl-4c21',
  service: 'checkout-api',
  version: '2026.8.25-1',
  commit_sha: 'a19f3c2',
  author: 'r.okafor',
  message: 'Raise upstream client timeout',
  deployed_at: '2026-08-25T15:02:00.000Z',
  status: 'live',
  changed_files: ['src/checkout/upstreamClient.ts'],
};

const health = {
  service: 'checkout-api',
  status: 'degraded',
  live_deployment_id: 'dpl-4c21',
  replicas_ready: 6,
  replicas_desired: 8,
  checks: [{ name: 'readiness', ok: false, detail: '2 of 8 failing' }],
};

const incident = {
  id: 'INC-2048',
  title: 'Checkout p95 latency regression',
  service: 'checkout-api',
  severity: 'SEV-2',
  status: 'investigating',
  summary: 'Probe breached its budget.',
  detected_at: '2026-08-25T15:04:00.000Z',
  detected_by: 'synthetic-probe',
  notes: [],
};

const valid = {
  service: 'checkout-api',
  incidents: [incident],
  live_deployment: deployment,
  health,
  deployments: [deployment],
};

describe('isEstateState', () => {
  it('accepts a well-formed payload', () => {
    expect(isEstateState(valid)).toBe(true);
  });

  it('accepts null live_deployment and health, which the server legitimately sends', () => {
    expect(isEstateState({ ...valid, live_deployment: null, health: null })).toBe(true);
  });

  it('accepts empty collections', () => {
    expect(isEstateState({ ...valid, incidents: [], deployments: [] })).toBe(true);
  });

  // The exact case the shallow guard let through.
  it('rejects a null entry inside incidents', () => {
    expect(isEstateState({ ...valid, incidents: [null] })).toBe(false);
  });

  it('rejects an incident missing a rendered field', () => {
    const { title: _title, ...withoutTitle } = incident;
    expect(isEstateState({ ...valid, incidents: [withoutTitle] })).toBe(false);
  });

  it('rejects an incident whose notes are malformed', () => {
    expect(isEstateState({ ...valid, incidents: [{ ...incident, notes: [{ at: 1 }] }] })).toBe(
      false,
    );
  });

  it('rejects a malformed live_deployment', () => {
    expect(isEstateState({ ...valid, live_deployment: { id: 'dpl-4c21' } })).toBe(false);
  });

  it('rejects health with a non-numeric replica count', () => {
    expect(isEstateState({ ...valid, health: { ...health, replicas_ready: '6' } })).toBe(false);
  });

  it('rejects health whose checks are malformed', () => {
    expect(
      isEstateState({ ...valid, health: { ...health, checks: [{ name: 'x', ok: 'yes' }] } }),
    ).toBe(false);
  });

  it('rejects a deployment with non-string changed_files', () => {
    expect(isEstateState({ ...valid, deployments: [{ ...deployment, changed_files: [3] }] })).toBe(
      false,
    );
  });

  it('rejects missing top-level keys', () => {
    const { deployments: _deployments, ...withoutDeployments } = valid;
    expect(isEstateState(withoutDeployments)).toBe(false);
  });

  it.each([null, undefined, 'string', 42, []])('rejects non-object input: %s', (input) => {
    expect(isEstateState(input)).toBe(false);
  });
});
