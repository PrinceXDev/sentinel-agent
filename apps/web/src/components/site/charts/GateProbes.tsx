import { GATE_PROBE_VERDICT_STYLE, GATE_PROBES } from '@/constants/gateProbes';

/**
 * The four routes `npm run prove:gate` drives at `rollback_deployment`.
 *
 * Two of the four verdicts are deliberately not "pass". A conformance suite
 * that reports confidence about evidence it never gathered is worse than no
 * suite at all, so "the model didn't try" and "the route was never entered"
 * each get their own verdict rather than being folded into a green tick.
 */
export const GateProbes = () => {
  return (
    <div className="my-8 space-y-3">
      {GATE_PROBES.map((p) => {
        const s = GATE_PROBE_VERDICT_STYLE[p.verdict];
        return (
          <div
            key={p.id}
            className="rounded-xl border border-line bg-surface p-5 transition hover:border-line-strong"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-dim">
                {p.id}
              </span>
              <code className="font-mono text-[13px] text-ink">{p.route}</code>
              <span
                className="ml-auto rounded-full px-2.5 py-1 font-mono text-[10.5px] tracking-wider"
                style={{ color: s.color, background: s.bg }}
              >
                {p.label}
              </span>
            </div>
            <p className="mt-2.5 text-[13.5px] text-muted leading-relaxed">{p.detail}</p>
          </div>
        );
      })}
    </div>
  );
};
