/**
 * What actually changed, according to the estate.
 *
 * Every entry was written by the estate store at the moment a tool mutated it —
 * not derived from the agent's transcript. So this answers a different question
 * from the timeline: not "what did the agent say it did" but "what did the system
 * record happening".
 *
 * Usually they agree and this panel is unremarkable. It earns its place in the
 * case where they would not: an agent that narrates a rollback it never performed
 * leaves this list empty, and that is visible immediately. An approval gate is
 * only as trustworthy as your ability to confirm what got through it.
 *
 * Presentational — data comes from `useEstate` via the parent.
 */

import type { AuditEntry } from '@/lib/estate';
import { formatClock } from '@/lib/formatClock';

interface AuditTrailProps {
  entries: AuditEntry[] | null;
  error: string | null;
  loading: boolean;
}

export function AuditTrail({ entries, error, loading }: AuditTrailProps) {
  if (error) {
    return <p className="break-words text-danger text-xs leading-relaxed">{error}</p>;
  }

  if (loading || entries === null) {
    return <p className="text-dim text-xs">Loading…</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-dim text-xs leading-relaxed">
        Nothing has changed the estate. Read-only tools leave no entry here by design — only writes
        and production changes do.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <li key={`${entry.at}:${entry.tool}`} className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="tnum font-mono text-[0.62rem] text-dim">{formatClock(entry.at)}</span>
            <code className="font-mono text-[0.68rem] text-ok">{entry.tool}</code>
          </div>
          <p className="text-[0.7rem] text-muted leading-snug">{entry.summary}</p>
          <p className="font-mono text-[0.6rem] text-dim">by {entry.actor}</p>
        </li>
      ))}
    </ol>
  );
}
