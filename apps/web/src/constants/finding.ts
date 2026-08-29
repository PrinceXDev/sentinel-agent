/**
 * Presentation data for structured findings.
 *
 * The action vocabulary is deliberately not ranked by how decisive it sounds.
 * `no_action` is styled as a settled, healthy outcome rather than a null result,
 * because it is frequently the correct answer — a symptom that already recovered,
 * or a cause outside the estate — and a UI that renders it as an absence teaches
 * an operator to read "did nothing" as "failed to conclude".
 */

import type { Finding, RecommendedAction } from '@/lib/estate';

export interface ActionPresentation {
  readonly label: string;
  /** One line under the headline, saying what the agent is actually asking for. */
  readonly summary: string;
  readonly tone: string;
  readonly border: string;
  readonly background: string;
  /** True when acting on this requires a production mutation, and therefore the gate. */
  readonly gated: boolean;
}

export const ACTION_PRESENTATION: Readonly<Record<RecommendedAction, ActionPresentation>> = {
  rollback: {
    label: 'Roll back',
    summary: 'A production change is implicated and reverting it is the smallest fix.',
    tone: 'text-gate',
    border: 'border-gate/40',
    background: 'bg-gate/5',
    gated: true,
  },
  restart: {
    label: 'Restart service',
    summary: 'Process state rather than code is implicated.',
    tone: 'text-gate',
    border: 'border-gate/40',
    background: 'bg-gate/5',
    gated: true,
  },
  no_action: {
    label: 'No action',
    summary:
      'Nothing in this estate needs changing, and changing something would cost more than it fixes.',
    tone: 'text-ok',
    border: 'border-ok/40',
    background: 'bg-ok/5',
    gated: false,
  },
  escalate: {
    label: 'Escalate',
    summary: 'The cause is real and ongoing, but not reachable from here.',
    tone: 'text-steel',
    border: 'border-steel/40',
    background: 'bg-steel/5',
    gated: false,
  },
};

export interface VerdictPresentation {
  readonly label: string;
  readonly tone: string;
}

export const AUDIT_VERDICT: Readonly<Record<string, VerdictPresentation>> = {
  supported: { label: 'Evidence supports the conclusion', tone: 'text-ok' },
  partially_supported: { label: 'Evidence partially supports the conclusion', tone: 'text-gate' },
  unsupported: { label: 'Evidence does not support the conclusion', tone: 'text-danger' },
};

/**
 * Claims the auditor could not trace to their cited source, as a lookup.
 *
 * Matched on the claim text because that is the only identity an `EvidenceLink`
 * has — the schema deliberately has no ids, since asking a model to invent and
 * then correctly reuse them across two separate agents is a reliability problem
 * traded for a cosmetic one.
 */
export const unsupportedClaims = (finding: Finding): ReadonlySet<string> =>
  new Set(finding.audit?.unsupported_claims ?? []);
