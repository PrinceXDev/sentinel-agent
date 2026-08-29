/**
 * Guard tests for the findings payload, and for approval risk tiering.
 *
 * `isFindingsPayload` matters for the same reason `isEstateState` does — the
 * types are duplicated across an HTTP boundary, so nothing but this guard catches
 * server drift. It matters slightly more, because this payload drives the
 * confidence dial and the evidence ledger: a malformed `evidence` entry would
 * render a claim with no source as though it had one, which is precisely the
 * failure the structured finding exists to make visible.
 *
 * `tierFor` decides whether an approval gets the amber production treatment or
 * the steel non-production one. Getting it wrong in the permissive direction
 * would render a rollback as routine, so the unknown-tool case is asserted
 * explicitly.
 */

import { describe, expect, it } from 'vitest';

import { HEADLINE_ARGS, TIER_PRESENTATION, tierFor } from '../constants/approval';
import { ACTION_PRESENTATION, unsupportedClaims } from '../constants/finding';
import { type Finding, isFindingsPayload } from './estate';

const finding: Finding = {
  at: '2026-08-25T15:31:00Z',
  incident_id: 'INC-2048',
  root_cause: 'Upstream timeout raised to 30s with 3 retries against a 400ms budget.',
  culprit_deployment_id: 'dpl-4c21',
  recommended_action: 'rollback',
  confidence: 92,
  confidence_rationale: 'Mechanism established from the diff.',
  evidence: [{ claim: 'p95 rose 3.7x', source: 'sandbox run 1', detail: '178ms → 658ms' }],
  ruled_out: [{ candidate: 'dpl-4c20', reason: 'Metrics-only change.' }],
  verification_plan: 'Re-read p95 over the 10 minutes after rollback.',
  injections_detected: [],
  audit: null,
};

const valid = { findings: [finding], latest: finding };

describe('isFindingsPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(isFindingsPayload(valid)).toBe(true);
  });

  it('accepts a null latest, which is the pre-finding state', () => {
    expect(isFindingsPayload({ findings: [], latest: null })).toBe(true);
  });

  it('accepts a null culprit, which is how "no deployment caused this" is expressed', () => {
    const noCulprit = { ...finding, culprit_deployment_id: null, recommended_action: 'no_action' };
    expect(isFindingsPayload({ findings: [noCulprit], latest: noCulprit })).toBe(true);
  });

  it('rejects an evidence entry missing its source', () => {
    const bad = { ...finding, evidence: [{ claim: 'p95 rose', detail: 'x' }] };
    expect(isFindingsPayload({ findings: [bad], latest: bad })).toBe(false);
  });

  it('rejects a non-numeric confidence', () => {
    const bad = { ...finding, confidence: 'high' };
    expect(isFindingsPayload({ findings: [bad], latest: bad })).toBe(false);
  });

  it('rejects a malformed audit rather than dropping it', () => {
    // Silently discarding it would render the finding as unaudited, which is a
    // different and more reassuring claim than "the audit could not be read".
    const bad = { ...finding, audit: { verdict: 'supported' } };
    expect(isFindingsPayload({ findings: [bad], latest: bad })).toBe(false);
  });

  it('accepts a fully-formed audit', () => {
    const audited = {
      ...finding,
      audit: {
        at: '2026-08-25T15:33:00Z',
        auditor: 'evidence-auditor',
        confidence: 68,
        verdict: 'partially_supported',
        unsupported_claims: ['p95 rose 3.7x'],
        gaps: ['rps not checked'],
        rationale: 'The cited run is not named precisely enough to re-derive.',
      },
    };
    expect(isFindingsPayload({ findings: [audited], latest: audited })).toBe(true);
  });

  it.each([null, undefined, 'string', 42, []])('rejects non-object input: %s', (input) => {
    expect(isFindingsPayload(input)).toBe(false);
  });
});

describe('tierFor', () => {
  it.each(['rollback_deployment', 'restart_service'])('treats %s as destructive', (name) => {
    expect(tierFor(name)).toBe('destructive');
  });

  it.each(['post_incident_note', 'record_finding', 'audit_finding'])(
    'treats %s as a non-production write',
    (name) => {
      expect(tierFor(name)).toBe('write');
    },
  );

  it('treats an unrecognised tool as destructive', () => {
    // The tool list is duplicated across an HTTP boundary, so it can drift. It
    // must only be able to drift in the direction that over-warns.
    expect(tierFor('drop_database')).toBe('destructive');
    expect(tierFor('')).toBe('destructive');
  });
});

describe('presentation tables', () => {
  it('reserves amber for production mutations only', () => {
    expect(TIER_PRESENTATION.destructive.accent).toContain('gate');
    expect(TIER_PRESENTATION.write.accent).not.toContain('gate');
  });

  it('does not style no_action as a failure to conclude', () => {
    // `no_action` is frequently the correct answer, and a UI that renders it as
    // an absence teaches an operator to read it as "did not finish".
    expect(ACTION_PRESENTATION.no_action.tone).toBe('text-ok');
    expect(ACTION_PRESENTATION.no_action.gated).toBe(false);
  });

  it('marks exactly the production-mutating actions as gated', () => {
    const gated = Object.entries(ACTION_PRESENTATION)
      .filter(([, v]) => v.gated)
      .map(([k]) => k);
    expect(gated.sort()).toEqual(['restart', 'rollback']);
  });

  it('promotes the arguments an approver reads first', () => {
    expect(HEADLINE_ARGS).toContain('deployment_id');
    expect(HEADLINE_ARGS).toContain('reason');
  });
});

describe('unsupportedClaims', () => {
  it('is empty when the finding has not been audited', () => {
    expect(unsupportedClaims(finding).size).toBe(0);
  });

  it('indexes the claims the auditor could not trace', () => {
    const audited: Finding = {
      ...finding,
      audit: {
        at: '2026-08-25T15:33:00Z',
        auditor: 'evidence-auditor',
        confidence: 68,
        verdict: 'partially_supported',
        unsupported_claims: ['p95 rose 3.7x'],
        gaps: [],
        rationale: 'x',
      },
    };
    expect(unsupportedClaims(audited).has('p95 rose 3.7x')).toBe(true);
    expect(unsupportedClaims(audited).has('something else')).toBe(false);
  });
});
