import { buildSeries, settledComparison } from '@/lib/site/incidentSeries';

/**
 * The three golden signals, before and after, side by side.
 *
 * This is the panel that does the actual ruling-out: latency and errors move
 * together while throughput does not, which is what separates "a change broke
 * it" from "more traffic arrived".
 */
export const SignalDelta = () => {
  const stats = settledComparison(buildSeries());

  const rows = [
    {
      signal: 'p95 latency',
      before: `${stats.baselineP95.toFixed(0)} ms`,
      after: `${stats.plateauP95.toFixed(0)} ms`,
      delta: `${stats.ratio.toFixed(2)}×`,
      moved: true,
      note: 'Breached the 400ms budget and stayed there.',
    },
    {
      signal: 'error rate',
      before: `${(stats.baselineErr * 100).toFixed(2)}%`,
      after: `${(stats.plateauErr * 100).toFixed(2)}%`,
      delta: `${stats.errRatio.toFixed(1)}×`,
      moved: true,
      note: 'Moved with latency — consistent with timeouts, not with load.',
    },
    {
      signal: 'throughput',
      before: `${stats.baselineRps.toFixed(0)} rps`,
      after: `${stats.plateauRps.toFixed(0)} rps`,
      delta: `${(stats.rpsDelta * 100).toFixed(1)}%`,
      moved: false,
      note: 'Flat. No traffic surge. The cause is inside the service.',
    },
  ];

  return (
    <div className="my-8 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.7fr] gap-2 border-line border-b px-5 py-3">
        {['signal', 'settled before', 'settled after', 'change'].map((h) => (
          <div key={h} className="eyebrow">
            {h}
          </div>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.signal} className="border-line border-b px-5 py-4 last:border-0">
          <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.7fr] items-center gap-2">
            <div className="text-[14px] text-ink">{r.signal}</div>
            <div className="tnum font-mono text-[13px] text-muted">{r.before}</div>
            <div className="tnum font-mono text-[13px] text-ink">{r.after}</div>
            <div
              className="tnum font-mono font-medium text-[14px]"
              style={{ color: r.moved ? 'var(--color-danger)' : 'var(--color-ok)' }}
            >
              {r.delta}
            </div>
          </div>
          <p className="mt-1.5 text-[12.5px] text-dim">{r.note}</p>
        </div>
      ))}
    </div>
  );
};
