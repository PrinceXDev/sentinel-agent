/**
 * Estate behaviour tests.
 *
 * Two things matter here beyond the obvious: the fixture must be deterministic
 * (the demo depends on it), and the regression the agent is asked to find must
 * actually be present in the data with the magnitude the scenario claims.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { buildMetrics, DEPLOY_AT, SERVICE } from './fixtures.js';
import { EstateError, estate } from './store.js';

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

beforeEach(() => {
  estate.reset();
});

describe('fixtures', () => {
  it('are deterministic across builds', () => {
    expect(buildMetrics()).toEqual(buildMetrics());
  });

  it('cover the incident window at minute resolution', () => {
    const samples = buildMetrics();
    expect(samples.length).toBe(61);
    for (let i = 1; i < samples.length; i += 1) {
      const gap = Date.parse(samples[i]!.ts) - Date.parse(samples[i - 1]!.ts);
      expect(gap).toBe(60_000);
    }
  });

  it('contain a latency regression of roughly 3.7x after the deploy', () => {
    const samples = buildMetrics();
    const before = samples.filter((s) => Date.parse(s.ts) < DEPLOY_AT);
    // Skip the ramp; compare the settled plateau.
    const after = samples.filter((s) => Date.parse(s.ts) >= DEPLOY_AT + 5 * 60_000);

    const ratio =
      mean(after.map((s) => s.p95_latency_ms)) / mean(before.map((s) => s.p95_latency_ms));
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(3.9);
  });

  it('hold throughput steady, so the regression cannot be explained by load', () => {
    const samples = buildMetrics();
    const before = samples.filter((s) => Date.parse(s.ts) < DEPLOY_AT).map((s) => s.rps);
    const after = samples.filter((s) => Date.parse(s.ts) >= DEPLOY_AT).map((s) => s.rps);
    expect(Math.abs(mean(after) - mean(before))).toBeLessThan(5);
  });
});

describe('reads', () => {
  it('returns the seeded incident', () => {
    const incident = estate.getIncident('INC-2048');
    expect(incident?.service).toBe(SERVICE);
    expect(incident?.status).toBe('investigating');
  });

  it('returns undefined for an unknown incident', () => {
    expect(estate.getIncident('INC-0000')).toBeUndefined();
  });

  it('reports dpl-4c21 as live before any remediation', () => {
    expect(estate.liveDeployment(SERVICE)?.id).toBe('dpl-4c21');
  });

  it('reports the service as degraded while the regression is live', () => {
    const health = estate.getHealth(SERVICE);
    expect(health?.status).toBe('degraded');
    expect(health?.checks.some((c) => !c.ok)).toBe(true);
  });

  it('filters metrics by window', () => {
    const all = estate.getMetrics(SERVICE);
    const slice = estate.getMetrics(SERVICE, '2026-08-25T15:00:00Z', '2026-08-25T15:10:00Z');
    expect(slice.length).toBe(11);
    expect(slice.length).toBeLessThan(all.length);
  });
});

describe('post_incident_note', () => {
  it('appends a note and records it in the audit log', () => {
    const updated = estate.addIncidentNote(
      'INC-2048',
      'sentinel-agent',
      'p95 up 3.7x after dpl-4c21',
    );
    expect(updated?.notes.length).toBe(1);
    expect(estate.listAudit().at(-1)?.tool).toBe('post_incident_note');
  });

  it('returns undefined for an unknown incident', () => {
    expect(estate.addIncidentNote('INC-0000', 'sentinel-agent', 'x')).toBeUndefined();
  });
});

describe('rollback_deployment', () => {
  it('promotes the preceding deployment and retires the current one', () => {
    const result = estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');

    expect(result.rolled_back).toBe('dpl-4c21');
    expect(result.now_live).toBe('dpl-4c20');
    expect(estate.getDeployment('dpl-4c21')?.status).toBe('rolled_back');
    expect(estate.liveDeployment(SERVICE)?.id).toBe('dpl-4c20');
  });

  it('moves the incident to mitigated and the service back to healthy', () => {
    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');
    expect(estate.getIncident('INC-2048')?.status).toBe('mitigated');
    expect(estate.getHealth(SERVICE)?.status).toBe('healthy');
  });

  it('lets the agent verify recovery by re-reading metrics', () => {
    const before = estate.getMetrics(SERVICE);
    const beforeTail = before.at(-1)!.p95_latency_ms;

    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');

    const after = estate.getMetrics(SERVICE);
    // New samples arrived; the window did not merely change shape.
    expect(after.length).toBeGreaterThan(before.length);
    // And the symptom is visibly resolving, which is what the agent is
    // instructed to confirm. Anchoring recovery to wall-clock `now` — later than
    // every fixture sample — made this unobservable.
    expect(after.at(-1)!.p95_latency_ms).toBeLessThan(beforeTail / 2);
    expect(after.at(-1)!.p95_latency_ms).toBeLessThan(220);
  });

  it('does not rewrite the window the agent already analysed', () => {
    const before = estate.getMetrics(SERVICE).map((s) => ({ ...s }));
    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');
    const after = estate.getMetrics(SERVICE);

    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('leaves throughput alone while latency recovers', () => {
    const beforeRps = estate.getMetrics(SERVICE).at(-1)!.rps;
    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');
    const afterRps = estate.getMetrics(SERVICE).at(-1)!.rps;

    // A recovery that also "fixed" a signal that was never broken would be a
    // tell that the data is synthetic rather than a simulation of one.
    expect(Math.abs(afterRps - beforeRps)).toBeLessThan(12);
  });

  it('records the mutation in the audit log', () => {
    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');
    const entry = estate.listAudit().at(-1);
    expect(entry?.tool).toBe('rollback_deployment');
    expect(entry?.details.now_live).toBe('dpl-4c20');
  });

  it('refuses an unknown deployment', () => {
    expect(() => estate.rollbackDeployment('dpl-nope', 'sentinel-agent')).toThrow(EstateError);
  });

  it('refuses a deployment that is not live', () => {
    expect(() => estate.rollbackDeployment('dpl-4c19', 'sentinel-agent')).toThrow(/not live/);
  });

  it('refuses to roll back twice', () => {
    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');
    expect(() => estate.rollbackDeployment('dpl-4c21', 'sentinel-agent')).toThrow(/not live/);
  });
});

describe('deployAnchor', () => {
  // Qodo (Medium): the anchor was the fixture constant, so after a rollback it
  // pointed at a deployment that was no longer live. The agent uses this as its
  // candidate change point, so a stale anchor makes post-remediation
  // verification split its series at the wrong timestamp — and conclude the
  // rollback had not worked.
  it('matches the live deployment before any remediation', () => {
    expect(estate.deployAnchor(SERVICE)).toBe(estate.liveDeployment(SERVICE)?.deployed_at);
  });

  it('follows the live deployment after a rollback', () => {
    const before = estate.deployAnchor(SERVICE);
    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');
    const after = estate.deployAnchor(SERVICE);

    expect(after).not.toBe(before);
    expect(after).toBe(estate.getDeployment('dpl-4c20')?.deployed_at);
    expect(estate.liveDeployment(SERVICE)?.id).toBe('dpl-4c20');
  });

  it('is always the timestamp of whichever deployment is live', () => {
    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');
    expect(estate.deployAnchor(SERVICE)).toBe(estate.liveDeployment(SERVICE)?.deployed_at);
  });
});

describe('restart_service', () => {
  it('reports the replica count it restarted', () => {
    const result = estate.restartService(SERVICE, 'sentinel-agent');
    expect(result.replicas).toBe(8);
    expect(estate.listAudit().at(-1)?.tool).toBe('restart_service');
  });

  it('refuses an unknown service', () => {
    expect(() => estate.restartService('nope-api', 'sentinel-agent')).toThrow(EstateError);
  });
});

describe('preview_remediation', () => {
  it('describes the rollback transition without performing it', () => {
    const preview = estate.previewRollback('dpl-4c21');

    expect(preview.executable).toBe(true);
    expect(preview.changes).toContainEqual({
      subject: 'dpl-4c21',
      field: 'status',
      from: 'live',
      to: 'rolled_back',
    });
    // The point of a dry run: nothing moved.
    expect(estate.getDeployment('dpl-4c21')?.status).toBe('live');
    expect(estate.listAudit()).toHaveLength(0);
  });

  it('agrees with what the real call then does', () => {
    const preview = estate.previewRollback('dpl-4c21');
    const promised = new Map(preview.changes.map((c) => [`${c.subject}.${c.field}`, c.to]));

    estate.rollbackDeployment('dpl-4c21', 'sentinel-agent');

    // A preview that could diverge from the call would manufacture confidence
    // rather than inform it, so this is the assertion that matters most here.
    expect(estate.getDeployment('dpl-4c21')?.status).toBe(promised.get('dpl-4c21.status'));
    expect(estate.getDeployment('dpl-4c20')?.status).toBe(promised.get('dpl-4c20.status'));
    expect(estate.getIncident('INC-2048')?.status).toBe(promised.get('INC-2048.status'));
  });

  it('reports why a rollback cannot run, rather than throwing', () => {
    const preview = estate.previewRollback('dpl-4c19');
    expect(preview.executable).toBe(false);
    expect(preview.blocked_reason).toMatch(/not live/);
    expect(preview.changes).toHaveLength(0);
  });

  it('does not claim a restart is reversible', () => {
    const preview = estate.previewRestart(SERVICE);
    expect(preview.executable).toBe(true);
    // A restart cannot be un-restarted and the dropped requests are gone.
    expect(preview.reversible).toBe(false);
    expect(preview.blast_radius).toMatch(/dropped/i);
  });
});

const sampleFinding = {
  incident_id: 'INC-2048',
  root_cause: 'Upstream timeout raised to 30s with 3 retries against a 400ms budget.',
  culprit_deployment_id: 'dpl-4c21',
  recommended_action: 'rollback' as const,
  confidence: 92,
  confidence_rationale: 'Mechanism established from the diff; magnitude computed in the sandbox.',
  evidence: [{ claim: 'p95 rose 3.7x', source: 'sandbox run 1', detail: '178ms → 658ms' }],
  ruled_out: [{ candidate: 'dpl-4c20', reason: 'Metrics-only change, landed a day earlier.' }],
  verification_plan: 'Re-read p95 over the 10 minutes after rollback; expect a return under 200ms.',
  injections_detected: [],
};

describe('findings', () => {
  it('records a finding with no audit attached', () => {
    const finding = estate.recordFinding(sampleFinding);

    expect(finding?.audit).toBeNull();
    expect(estate.latestFinding()?.confidence).toBe(92);
    expect(estate.listAudit().at(-1)?.tool).toBe('record_finding');
  });

  it('refuses a finding against an unknown incident', () => {
    expect(estate.recordFinding({ ...sampleFinding, incident_id: 'INC-0000' })).toBeUndefined();
  });

  it('attaches an independent audit and records the confidence gap', () => {
    estate.recordFinding(sampleFinding);
    estate.auditFinding('INC-2048', {
      auditor: 'evidence-auditor',
      verdict: 'partially_supported',
      confidence: 68,
      unsupported_claims: ['p95 rose 3.7x'],
      gaps: ['No check that rps stayed flat.'],
      rationale: 'The cited sandbox run is not named precisely enough to re-derive.',
    });

    expect(estate.latestFinding()?.audit?.verdict).toBe('partially_supported');
    // The gap between the two numbers is the signal the auditor exists to produce.
    expect(estate.listAudit().at(-1)?.details.confidence_delta).toBe(-24);
  });

  it('refuses an audit attributed to the investigating actor', () => {
    estate.recordFinding(sampleFinding);
    // The only separation check available: MCP calls carry no caller identity, so
    // the server cannot otherwise tell the investigator from the reviewer. This
    // catches the naive self-audit and nothing more, which is why the stored
    // audit is marked unverified.
    expect(() =>
      estate.auditFinding('INC-2048', {
        auditor: 'sentinel-agent',
        verdict: 'supported',
        confidence: 95,
        unsupported_claims: [],
        gaps: [],
        rationale: 'Looks right to me.',
      }),
    ).toThrow(/cannot be attributed to sentinel-agent/);
  });

  it('records the reviewer identity as unverified', () => {
    estate.recordFinding(sampleFinding);
    estate.auditFinding('INC-2048', {
      auditor: 'evidence-auditor',
      verdict: 'supported',
      confidence: 90,
      unsupported_claims: [],
      gaps: [],
      rationale: 'x',
    });
    // A field rather than a paragraph, so nothing downstream can present a
    // self-declared reviewer as a confirmed independent one.
    expect(estate.latestFinding()?.audit?.identity_verified).toBe(false);
  });

  it('refuses an audit with no finding to audit', () => {
    expect(
      estate.auditFinding('INC-2048', {
        auditor: 'evidence-auditor',
        verdict: 'supported',
        confidence: 90,
        unsupported_claims: [],
        gaps: [],
        rationale: 'x',
      }),
    ).toBeUndefined();
  });

  it('keeps superseded findings, so a change of mind is visible', () => {
    estate.recordFinding(sampleFinding);
    estate.recordFinding({ ...sampleFinding, confidence: 40, recommended_action: 'no_action' });

    expect(estate.listFindings()).toHaveLength(2);
    expect(estate.latestFinding()?.recommended_action).toBe('no_action');
  });
});

describe('scenarios', () => {
  it('boots on the checkout regression', () => {
    expect(estate.scenario.id).toBe('checkout-timeout-retry');
    expect(estate.service).toBe(SERVICE);
  });

  it('swaps the whole estate when a scenario is loaded', () => {
    estate.load('payments-upstream-decoy');

    expect(estate.service).toBe('payments-api');
    expect(estate.getIncident('INC-2051')).toBeDefined();
    // The previous scenario's estate is gone, not merged.
    expect(estate.getIncident('INC-2048')).toBeUndefined();
    expect(estate.getMetrics(SERVICE)).toHaveLength(0);

    estate.load('checkout-timeout-retry');
  });

  it('clears findings and audit on a scenario swap', () => {
    estate.recordFinding(sampleFinding);
    estate.load('orders-transient-blip');

    expect(estate.listFindings()).toHaveLength(0);
    expect(estate.listAudit()).toHaveLength(0);

    estate.load('checkout-timeout-retry');
  });

  it('refuses an unknown scenario rather than silently keeping the current one', () => {
    expect(() => estate.load('does-not-exist')).toThrow(EstateError);
    expect(estate.scenario.id).toBe('checkout-timeout-retry');
  });

  it('recovers toward the loaded scenario baseline, not the checkout one', () => {
    estate.load('search-injected-note');
    estate.rollbackDeployment('dpl-9147', 'sentinel-agent');

    const tail = estate.getMetrics('search-api').at(-1)!.p95_latency_ms;
    // search-api baselines at 310ms; a hardcoded 178 would have been visible here.
    expect(tail).toBeGreaterThan(280);
    expect(tail).toBeLessThan(340);

    estate.load('checkout-timeout-retry');
  });
});
