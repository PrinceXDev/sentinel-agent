'use client';

/**
 * The approval gate.
 *
 * This is the one component in the product that uses amber, and only for calls
 * that change production. Nothing else does, so the moment the agent stops and
 * asks is visually unlike anything else on screen rather than one alert among
 * several. Non-production writes get the same pause but a steel, compact card —
 * an operator who has clicked through three amber prompts approves the fourth
 * without reading it, and that fourth is the rollback.
 *
 * Three deliberate choices about honesty:
 *
 *  1. **The arguments are shown verbatim.** Not a summary of them. The human is
 *     authorising a specific call with specific arguments, and a prettified
 *     description is a place for a discrepancy to hide. The finding above is the
 *     agent's case; the payload below is what will actually execute, and both are
 *     shown because they can disagree.
 *  2. **When the join failed, it says so.** `tool.approval_required` carries no
 *     tool name, so detail is recovered by joining back through `sourceEventId`.
 *     If that lookup misses, the approval is still real and still blocking — so
 *     it is still offered, labelled as lacking detail, rather than hidden or
 *     guessed at.
 *  3. **An unaudited or disputed finding is called out on the card itself.** The
 *     approver should not have to scroll back to discover that the confidence
 *     number they are about to act on was never independently checked.
 *
 * Deny is not a secondary action styled as an afterthought. It is the same visual
 * weight as approve, because an approver who feels steered has not been asked a
 * question.
 */

import { useState } from 'react';

import { ConfidenceMeter } from '@/components/ConfidenceMeter';
import { HEADLINE_ARGS, TIER_PRESENTATION, tierFor } from '@/constants/approval';
import type { Finding } from '@/lib/estate';
import type { PendingApproval } from '@/lib/trueforge/types';

interface ApprovalGateProps {
  approvals: PendingApproval[];
  busy: boolean;
  /** The agent's recorded case, shown alongside the call it is asking to make. */
  finding: Finding | null;
  onApprove: (toolCallId: string) => void;
  onDeny: (toolCallId: string, reason?: string) => void;
}

export const ApprovalGate = ({
  approvals,
  busy,
  finding,
  onApprove,
  onDeny,
}: ApprovalGateProps) => {
  if (approvals.length === 0) return null;

  // The section takes the most serious tier present, so one destructive call
  // among several writes still gets the full treatment.
  const destructive = approvals.some((a) => tierFor(a.toolName) === 'destructive');
  const tier = destructive ? TIER_PRESENTATION.destructive : TIER_PRESENTATION.write;

  return (
    <section
      aria-labelledby="gate-heading"
      className={`gate-arrive relative border-y ${tier.border} ${tier.background} ${
        destructive ? 'gate-scan' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2.5 px-3 pt-4 sm:px-5">
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full breathe ${destructive ? 'bg-gate' : 'bg-steel'}`}
        />
        <h2
          id="gate-heading"
          className={`font-medium font-mono text-xs tracking-[0.14em] uppercase ${tier.accent}`}
        >
          {tier.heading}
        </h2>
        {approvals.length > 1 && (
          <span className="tnum text-dim text-xs">{approvals.length} pending</span>
        )}
        {destructive && (
          <span className="ml-auto font-mono text-[0.65rem] text-dim">
            execution is blocked in the harness, not in this page
          </span>
        )}
      </div>

      <p className="max-w-prose px-3 pt-2 text-muted text-sm sm:px-5">{tier.blurb}</p>

      <div className="flex flex-col gap-3 p-3 sm:p-5">
        {approvals.map((approval) => (
          <ApprovalCard
            key={approval.toolCallId}
            approval={approval}
            busy={busy}
            finding={finding}
            onApprove={onApprove}
            onDeny={onDeny}
          />
        ))}
      </div>
    </section>
  );
};

const ApprovalCard = ({
  approval,
  busy,
  finding,
  onApprove,
  onDeny,
}: {
  approval: PendingApproval;
  busy: boolean;
  finding: Finding | null;
  onApprove: (id: string) => void;
  onDeny: (id: string, reason?: string) => void;
}) => {
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');

  const tier = TIER_PRESENTATION[tierFor(approval.toolName)];
  const isDestructive = tierFor(approval.toolName) === 'destructive';
  const pretty = formatArgs(approval.argsRaw);
  const headline = headlineArgs(approval.args);

  return (
    <article className={`border bg-ground ${tier.cardBorder}`}>
      <div
        className={`flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5 ${
          isDestructive ? 'border-gate/20' : 'border-line'
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <code className={`font-medium font-mono text-sm ${tier.accent}`}>
            {approval.toolName}
          </code>
          {approval.serverName && <span className="eyebrow">via {approval.serverName}</span>}
        </div>
        <div className="flex items-baseline gap-3">
          <span className={`font-mono text-[0.65rem] tracking-wide ${tier.accent}`}>
            {tier.badge}
          </span>
          <span className="tnum font-mono text-[0.65rem] text-dim">{approval.toolCallId}</span>
        </div>
      </div>

      {!approval.resolved && (
        <p className="border-danger/30 border-b bg-danger/5 px-4 py-2 text-danger text-xs">
          Argument detail could not be recovered for this call — the requesting message was not
          found in the event index. The action is still blocked and still yours to decide.
        </p>
      )}

      {headline.length > 0 && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 border-line border-b px-4 py-3">
          {headline.map(([key, value]) => (
            <div key={key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="eyebrow">{key.replace(/_/g, ' ')}</dt>
              <dd
                className={`max-w-lg break-words text-xs leading-relaxed ${
                  key === 'reason' ? 'text-muted' : 'tnum font-mono text-ink'
                }`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {isDestructive && finding && <TheCase finding={finding} />}

      {pretty && (
        <details className="border-line border-b" open={!isDestructive}>
          <summary className="cursor-pointer px-4 py-2 text-dim text-xs transition-colors hover:text-muted">
            Exact payload that will execute
          </summary>
          <pre className="overflow-x-auto px-4 pb-3 font-mono text-[0.75rem] text-ink leading-relaxed">
            {pretty}
          </pre>
        </details>
      )}

      {denying ? (
        <div className="flex flex-col gap-2 border-line border-t p-4">
          <label htmlFor={`reason-${approval.toolCallId}`} className="eyebrow">
            reason (shown to the agent)
          </label>
          <textarea
            id={`reason-${approval.toolCallId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Why are you declining? The agent reads this and will not retry."
            className="resize-y border border-line bg-surface px-3 py-2 font-sans text-ink text-sm placeholder:text-dim focus:border-line-strong focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDeny(approval.toolCallId, reason.trim() || undefined)}
              className="border border-danger/50 bg-danger/10 px-4 py-2 font-medium text-danger text-sm transition-colors hover:bg-danger/20 disabled:opacity-40"
            >
              Confirm decline
            </button>
            <button
              type="button"
              onClick={() => setDenying(false)}
              className="px-4 py-2 text-muted text-sm hover:text-ink"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-line border-t p-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove(approval.toolCallId)}
            className={tier.approveClass}
          >
            {tier.approveLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDenying(true)}
            className="border border-line-strong px-5 py-2 font-medium text-ink text-sm transition-colors hover:border-danger/60 hover:text-danger disabled:opacity-40"
          >
            Decline
          </button>
          {isDestructive && (
            <span className="ml-auto max-w-xs text-right text-dim text-[0.7rem] leading-snug">
              Declining is free. The investigation is already recorded and the agent will report
              where it stands.
            </span>
          )}
        </div>
      )}
    </article>
  );
};

/**
 * The agent's case, inlined on the card.
 *
 * An approver who has to scroll away from the button to find out what the action
 * is based on will stop doing it by the third incident. Confidence, whether it
 * was independently audited, and how many claims the auditor disputed all belong
 * next to the thing being authorised.
 */
const TheCase = ({ finding }: { finding: Finding }) => {
  const disputed = finding.audit?.unsupported_claims.length ?? 0;

  return (
    <div className="flex flex-col gap-4 border-line border-b px-4 py-3 sm:flex-row sm:items-start sm:gap-6">
      <div className="shrink-0">
        <ConfidenceMeter finding={finding} size="compact" />
      </div>

      <div className="min-w-0 flex-1">
        <span className="eyebrow">the case</span>
        <p className="mt-1 text-ink text-xs leading-relaxed">{finding.root_cause}</p>

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <Fact label="evidence" value={plural(finding.evidence.length, 'sourced claim')} />
          <Fact label="ruled out" value={plural(finding.ruled_out.length, 'candidate')} />
          {finding.injections_detected.length > 0 && (
            <Fact
              label="injections"
              value={`${finding.injections_detected.length} refused`}
              tone="text-threat"
            />
          )}
        </div>

        {!finding.audit && (
          <p className="mt-2 border-gate/40 border-l-2 pl-2 text-gate text-[0.7rem] leading-snug">
            This conclusion has not been reviewed. The confidence figure is the investigating agent
            scoring its own work.
          </p>
        )}

        {disputed > 0 && (
          <p className="mt-2 border-danger/50 border-l-2 pl-2 text-danger text-[0.7rem] leading-snug">
            The reviewer could not trace {disputed} {disputed === 1 ? 'claim' : 'claims'} to the
            source cited for {disputed === 1 ? 'it' : 'them'}.
          </p>
        )}
      </div>
    </div>
  );
};

const Fact = ({
  label,
  value,
  tone = 'text-muted',
}: {
  label: string;
  value: string;
  tone?: string;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="eyebrow">{label}</span>
    <span className={`tnum font-mono text-[0.7rem] ${tone}`}>{value}</span>
  </div>
);

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Promote a few known keys to headline facts. Returns entries in `HEADLINE_ARGS` order. */
const headlineArgs = (args: unknown): [string, string][] => {
  if (typeof args !== 'object' || args === null) return [];
  const record = args as Record<string, unknown>;

  return HEADLINE_ARGS.flatMap((key) => {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim()) return [];
    return [[key, value] as [string, string]];
  });
};

/** Pretty-print arguments, falling back to the raw string when it will not parse. */
const formatArgs = (raw: string): string | null => {
  if (!raw.trim()) return null;
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2);
  } catch {
    return raw;
  }
};
