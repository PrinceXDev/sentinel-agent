'use client';

/**
 * The approval gate.
 *
 * This is the one component in the product that uses amber. Nothing else does,
 * so the moment the agent stops and asks is visually unlike anything else on
 * screen rather than one alert among several.
 *
 * Two deliberate choices about honesty:
 *
 *  1. **The arguments are shown verbatim.** Not a summary of them. The human is
 *     authorising a specific call with specific arguments, and a prettified
 *     description is a place for a discrepancy to hide.
 *  2. **When the join failed, it says so.** `tool.approval_required` carries no
 *     tool name, so detail is recovered by joining back through
 *     `sourceEventId`. If that lookup misses, the approval is still real and
 *     still blocking — so it is still offered, labelled as lacking detail,
 *     rather than hidden or guessed at.
 *
 * Deny is not a secondary action styled as an afterthought. It is the same
 * visual weight as approve, because an approver who feels steered has not been
 * asked a question.
 */

import { useState } from 'react';

import type { PendingApproval } from '@/lib/trueforge/types';

interface ApprovalGateProps {
  approvals: PendingApproval[];
  busy: boolean;
  onApprove: (toolCallId: string) => void;
  onDeny: (toolCallId: string, reason?: string) => void;
}

export const ApprovalGate = ({ approvals, busy, onApprove, onDeny }: ApprovalGateProps) => {
  if (approvals.length === 0) return null;

  return (
    <section aria-labelledby="gate-heading" className="border-gate/40 border-y bg-gate/[0.04]">
      <div className="flex items-center gap-2.5 px-3 pt-4 sm:px-5">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-gate breathe" />
        <h2
          id="gate-heading"
          className="font-medium font-mono text-gate text-xs tracking-[0.14em] uppercase"
        >
          Human approval required
        </h2>
        {approvals.length > 1 && (
          <span className="tnum text-dim text-xs">{approvals.length} pending</span>
        )}
      </div>

      <p className="max-w-prose px-3 pt-2 text-muted text-sm sm:px-5">
        sentinel-agent has finished investigating and prepared an action that changes production
        state. It will not run until you authorise it.
      </p>

      <div className="flex flex-col gap-3 p-5">
        {approvals.map((approval) => (
          <ApprovalCard
            key={approval.toolCallId}
            approval={approval}
            busy={busy}
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
  onApprove,
  onDeny,
}: {
  approval: PendingApproval;
  busy: boolean;
  onApprove: (id: string) => void;
  onDeny: (id: string, reason?: string) => void;
}) => {
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');

  const pretty = formatArgs(approval.argsRaw);

  return (
    <article className="border border-gate/30 bg-ground">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-gate/20 border-b px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <code className="font-medium font-mono text-gate text-sm">{approval.toolName}</code>
          {approval.serverName && <span className="eyebrow">via {approval.serverName}</span>}
        </div>
        <span className="tnum font-mono text-[0.65rem] text-dim">{approval.toolCallId}</span>
      </div>

      {!approval.resolved && (
        <p className="border-danger/30 border-b bg-danger/5 px-4 py-2 text-danger text-xs">
          Argument detail could not be recovered for this call — the requesting message was not
          found in the event index. The action is still blocked and still yours to decide.
        </p>
      )}

      {pretty && (
        <div className="px-4 py-3">
          <span className="eyebrow">arguments</span>
          <pre className="mt-1.5 overflow-x-auto font-mono text-[0.75rem] text-ink leading-relaxed">
            {pretty}
          </pre>
        </div>
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
        <div className="flex flex-wrap gap-2 border-line border-t p-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove(approval.toolCallId)}
            className="border border-gate bg-gate px-5 py-2 font-medium text-[#1a1206] text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDenying(true)}
            className="border border-line-strong px-5 py-2 font-medium text-ink text-sm transition-colors hover:border-danger/60 hover:text-danger disabled:opacity-40"
          >
            Decline
          </button>
        </div>
      )}
    </article>
  );
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
