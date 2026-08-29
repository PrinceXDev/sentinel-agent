'use client';

/**
 * The conclusion, as an inspectable object rather than a paragraph.
 *
 * Everything here comes from `record_finding` and `audit_finding` — structured
 * calls the agent made — not from parsing its prose. That is what lets the panel
 * make claims the prose could only assert: an evidence row whose `source` the
 * auditor rejected is struck through, and the count of unsourced claims is
 * rendered as a number rather than left for a reader to notice.
 *
 * The order is deliberate. Verdict, then how sure and who checked, then the
 * evidence, then what was eliminated, then what is still unknown. An engineer
 * reading this under pressure gets the answer in the first line and can stop; one
 * who intends to overrule it has to scroll, which is the right way round.
 */

import { ConfidenceMeter } from '@/components/ConfidenceMeter';
import { ACTION_PRESENTATION, AUDIT_VERDICT, unsupportedClaims } from '@/constants/finding';
import type { Finding } from '@/lib/estate';
import { formatClock } from '@/lib/formatClock';

interface RootCauseProps {
  finding: Finding | null;
  /** Superseded findings, so a change of mind is visible rather than overwritten. */
  history?: Finding[];
}

export const RootCause = ({ finding, history = [] }: RootCauseProps) => {
  if (!finding) return null;

  const action = ACTION_PRESENTATION[finding.recommended_action];
  const rejected = unsupportedClaims(finding);
  const superseded = history.length > 1 ? history.length - 1 : 0;

  return (
    <section aria-labelledby="rca-heading" className={`border-line border-b ${action.background}`}>
      <div className="flex items-center gap-2.5 px-3 pt-4 sm:px-5">
        <h2 id="rca-heading" className="eyebrow text-muted">
          root cause
        </h2>
        <span className="h-px flex-1 bg-line" />
        <span className="tnum font-mono text-[0.65rem] text-dim">{formatClock(finding.at)}</span>
      </div>

      <div className="px-3 pt-2 sm:px-5">
        <p className="max-w-3xl text-base text-ink leading-snug">{finding.root_cause}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`border px-2.5 py-1 font-medium font-mono text-[0.7rem] tracking-wide uppercase ${action.border} ${action.tone}`}
          >
            {action.label}
          </span>
          {finding.culprit_deployment_id ? (
            <span className="tnum font-mono text-muted text-xs">
              implicates <span className="text-ink">{finding.culprit_deployment_id}</span>
            </span>
          ) : (
            <span className="font-mono text-muted text-xs">no deployment implicated</span>
          )}
          {superseded > 0 && (
            <span className="ml-auto font-mono text-[0.65rem] text-dim">revised {superseded}×</span>
          )}
        </div>

        <p className="mt-1.5 max-w-2xl text-dim text-xs leading-relaxed">{action.summary}</p>
      </div>

      <div className="flex flex-col gap-5 px-3 py-4 sm:px-5 lg:flex-row lg:items-start lg:gap-8">
        <div className="shrink-0">
          <ConfidenceMeter finding={finding} />
          <p className="mt-2 max-w-xs text-dim text-[0.7rem] leading-relaxed">
            {finding.confidence_rationale}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <EvidenceLedger finding={finding} rejected={rejected} />
        </div>
      </div>

      {finding.audit && <AuditPanel finding={finding} />}

      {finding.ruled_out.length > 0 && (
        <div className="border-line border-t px-3 py-3 sm:px-5">
          <span className="eyebrow">ruled out</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {finding.ruled_out.map((r) => (
              <li key={r.candidate} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="font-mono text-muted line-through decoration-dim">
                  {r.candidate}
                </span>
                <span className="min-w-0 flex-1 text-dim leading-relaxed">{r.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-line border-t px-3 py-3 sm:px-5">
        <span className="eyebrow">how this gets verified</span>
        <p className="mt-1 max-w-3xl text-muted text-xs leading-relaxed">
          {finding.verification_plan}
        </p>
      </div>
    </section>
  );
};

/**
 * Claims paired with what produced them.
 *
 * The left rail is the source. Rendering it as a column rather than a trailing
 * citation means an unsourced claim leaves a visible hole, which is the entire
 * reason the finding is structured — prose can cite nothing and still read well.
 */
const EvidenceLedger = ({
  finding,
  rejected,
}: {
  finding: Finding;
  rejected: ReadonlySet<string>;
}) => {
  const disputed = finding.evidence.filter((e) => rejected.has(e.claim)).length;

  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="eyebrow">evidence</span>
        <span className="tnum font-mono text-[0.65rem] text-dim">
          {finding.evidence.length} {finding.evidence.length === 1 ? 'claim' : 'claims'}
        </span>
        {disputed > 0 && (
          <span className="tnum ml-auto font-mono text-[0.65rem] text-danger">
            {disputed} disputed by audit
          </span>
        )}
      </div>

      <ol className="mt-2 flex flex-col">
        {finding.evidence.map((item, i) => {
          const isRejected = rejected.has(item.claim);
          return (
            <li
              key={`${item.source}:${item.claim}`}
              className="row-in grid grid-cols-1 gap-x-3 border-line border-b py-2 last:border-b-0 sm:grid-cols-[minmax(0,9rem)_1fr]"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <div className="flex items-baseline gap-1.5">
                <span aria-hidden="true" className="tnum font-mono text-[0.6rem] text-dim">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`min-w-0 break-words font-mono text-[0.7rem] ${
                    isRejected ? 'text-danger' : 'text-steel'
                  }`}
                >
                  {item.source}
                </span>
              </div>

              <div className="min-w-0">
                <p
                  className={`text-xs leading-snug ${
                    isRejected ? 'text-muted line-through decoration-danger/60' : 'text-ink'
                  }`}
                >
                  {item.claim}
                </p>
                <p className="mt-0.5 break-words font-mono text-[0.7rem] text-dim leading-relaxed">
                  {item.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
};

/**
 * The second opinion, given its own colour and its own block.
 *
 * Nested inside the finding rather than placed beside it, because it is *about*
 * the finding — but visually separated, because an audit rendered in the same
 * tone as the conclusion it is checking reads as part of the conclusion.
 */
const AuditPanel = ({ finding }: { finding: Finding }) => {
  const audit = finding.audit;
  if (!audit) return null;

  const verdict = AUDIT_VERDICT[audit.verdict] ?? { label: audit.verdict, tone: 'text-muted' };

  return (
    <div className="border-audit/25 border-y bg-audit/[0.04] px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="eyebrow text-audit">independent audit</span>
        <span className={`font-medium text-xs ${verdict.tone}`}>{verdict.label}</span>
        <span className="tnum ml-auto font-mono text-[0.65rem] text-dim">{audit.auditor}</span>
      </div>

      <p className="mt-1.5 max-w-3xl text-muted text-xs leading-relaxed">{audit.rationale}</p>

      {audit.gaps.length > 0 && (
        <div className="mt-2.5">
          <span className="eyebrow">not examined</span>
          <ul className="mt-1 flex flex-col gap-1">
            {audit.gaps.map((gap) => (
              <li key={gap} className="flex items-baseline gap-2 text-xs">
                <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-audit" />
                <span className="text-dim leading-relaxed">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
