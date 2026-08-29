/**
 * Risk presentation for approval-gated calls.
 *
 * The gate pauses for `@write` and `@destructive` alike, but they are not the
 * same decision and must not look like it. Posting an incident note is outward-
 * facing and worth a click; rolling back production is irreversible in place and
 * is the moment the whole product exists for.
 *
 * Rendering both in amber would spend the one colour reserved for that moment on
 * a note, and an operator who has clicked through three amber cards approves the
 * fourth without reading it. So writes are steel and compact, destructive calls
 * are amber and full-height, and the tier is derived from the tool name rather
 * than from anything the model said about itself.
 */

export type ApprovalTier = 'write' | 'destructive';

/**
 * Tools that mutate production, mirroring `PRODUCTION_MUTATING_TOOLS` on the ops
 * server. Duplicated rather than imported for the same reason the estate types
 * are: the two apps are decoupled across an HTTP boundary. `tierFor` falls back
 * to `destructive` for anything unrecognised, so the duplication can only fail in
 * the safe direction — an unknown tool is treated as the more serious one.
 */
const PRODUCTION_MUTATING = new Set(['rollback_deployment', 'restart_service']);

/** Tools that change non-production state only. */
const NON_PRODUCTION_WRITES = new Set(['post_incident_note', 'record_finding', 'audit_finding']);

export const tierFor = (toolName: string): ApprovalTier =>
  NON_PRODUCTION_WRITES.has(toolName) && !PRODUCTION_MUTATING.has(toolName)
    ? 'write'
    : 'destructive';

export interface TierPresentation {
  readonly heading: string;
  readonly blurb: string;
  readonly badge: string;
  readonly accent: string;
  readonly border: string;
  readonly cardBorder: string;
  readonly background: string;
  readonly approveLabel: string;
  readonly approveClass: string;
}

export const TIER_PRESENTATION: Readonly<Record<ApprovalTier, TierPresentation>> = {
  destructive: {
    heading: 'Human approval required',
    blurb:
      'sentinel-agent has finished investigating and prepared an action that changes production state. It will not run until you authorise it.',
    badge: 'destructive · changes production',
    accent: 'text-gate',
    border: 'border-gate/40',
    cardBorder: 'border-gate/30',
    background: 'bg-gate/[0.04]',
    approveLabel: 'Authorise',
    approveClass:
      'border border-gate bg-gate px-6 py-2.5 font-medium text-[#1a1206] text-sm transition-opacity hover:opacity-90 disabled:opacity-40',
  },
  write: {
    heading: 'Confirmation required',
    blurb:
      'This writes to the incident record other responders read. It does not touch production.',
    badge: 'write · non-production',
    accent: 'text-steel',
    border: 'border-steel/30',
    cardBorder: 'border-line-strong',
    background: 'bg-steel/[0.03]',
    approveLabel: 'Confirm',
    approveClass:
      'border border-steel bg-steel/10 px-5 py-2 font-medium text-steel text-sm transition-colors hover:bg-steel/20 disabled:opacity-40',
  },
};

/**
 * Argument keys worth pulling out of the payload and showing as headline facts.
 *
 * The full arguments are always rendered verbatim underneath — this only decides
 * what gets promoted, so an approver reads "dpl-4c21" before reading JSON.
 */
export const HEADLINE_ARGS: readonly string[] = [
  'deployment_id',
  'service',
  'incident_id',
  'reason',
];
