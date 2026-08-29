import { LATENCY_CHART_PAD as PAD } from '@/constants/latencyChart';
import {
  BASE_P95,
  buildSeries,
  CHECKOUT_BUDGET_MS,
  DEPLOY_INDEX,
  RAMP_MINUTES,
  settledComparison,
  WINDOW_MINUTES,
} from '@/lib/site/incidentSeries';

const W = 760;
const H = 300;
const Y_MAX = 720;

const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

const x = (minute: number) => PAD.left + (minute / (WINDOW_MINUTES - 1)) * plotW;
const y = (ms: number) => PAD.top + plotH - (ms / Y_MAX) * plotH;

/**
 * The incident, as the agent sees it: 61 minute-resolution samples of the
 * golden signals, with nothing pre-computed. The change point, the ramp, and
 * the ratio are all things that have to be derived from this shape.
 */
export const LatencyChart = ({ annotated = true }: { annotated?: boolean }) => {
  const samples = buildSeries();
  const stats = settledComparison(samples);

  const line = (key: 'p95' | 'p50') =>
    samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.minute).toFixed(1)},${y(s[key]).toFixed(1)}`)
      .join(' ');

  const area = `${line('p95')} L${x(WINDOW_MINUTES - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  return (
    <figure className="my-8">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Checkout p95 latency across the incident window. Flat at ${Math.round(stats.baselineP95)} milliseconds until the 15:02 deployment, then a four-minute ramp to a plateau of ${Math.round(stats.plateauP95)} milliseconds — ${stats.ratio.toFixed(2)} times baseline.`}
      >
        <title>checkout-api p95 latency, 14:30–15:30 UTC</title>
        <defs>
          <linearGradient id="p95fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-steel)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--color-steel)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid + y axis */}
        {[0, 200, 400, 600].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 10}
              y={y(v) + 4}
              textAnchor="end"
              className="tnum"
              fill="var(--color-dim)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Ramp band — the window the analysis deliberately throws away */}
        <rect
          x={x(DEPLOY_INDEX)}
          y={PAD.top}
          width={x(DEPLOY_INDEX + RAMP_MINUTES) - x(DEPLOY_INDEX)}
          height={plotH}
          fill="var(--color-line-strong)"
          opacity="0.45"
        />

        {/* The 400ms checkout budget */}
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={y(CHECKOUT_BUDGET_MS)}
          y2={y(CHECKOUT_BUDGET_MS)}
          stroke="var(--color-danger)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.75"
        />
        <text
          x={PAD.left + plotW + 8}
          y={y(CHECKOUT_BUDGET_MS) + 3.5}
          fill="var(--color-danger)"
          fontSize="10"
          fontFamily="var(--font-mono)"
        >
          400ms budget
        </text>

        <path d={area} fill="url(#p95fill)" />
        <path d={line('p95')} fill="none" stroke="var(--color-steel)" strokeWidth="1.9" />
        <path
          d={line('p50')}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="1.1"
          opacity="0.6"
        />

        {/* Deploy marker */}
        <line
          x1={x(DEPLOY_INDEX)}
          x2={x(DEPLOY_INDEX)}
          y1={PAD.top - 8}
          y2={PAD.top + plotH}
          stroke="var(--color-ink)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.55"
        />
        <text
          x={x(DEPLOY_INDEX) - 6}
          y={PAD.top - 12}
          textAnchor="end"
          fill="var(--color-ink)"
          fontSize="10.5"
          fontFamily="var(--font-mono)"
        >
          15:02 · dpl-4c21
        </text>

        {annotated ? (
          <>
            {/* Settled baseline */}
            <line
              x1={x(4)}
              x2={x(DEPLOY_INDEX - 2)}
              y1={y(stats.baselineP95)}
              y2={y(stats.baselineP95)}
              stroke="var(--color-ok)"
              strokeWidth="1.4"
            />
            <text
              x={x(4)}
              y={y(stats.baselineP95) - 8}
              fill="var(--color-ok)"
              fontSize="10.5"
              fontFamily="var(--font-mono)"
            >
              baseline {stats.baselineP95.toFixed(1)}ms · n={stats.beforeCount}
            </text>

            {/* Settled plateau */}
            <line
              x1={x(DEPLOY_INDEX + RAMP_MINUTES)}
              x2={x(WINDOW_MINUTES - 1)}
              y1={y(stats.plateauP95)}
              y2={y(stats.plateauP95)}
              stroke="var(--color-ok)"
              strokeWidth="1.4"
            />
            <text
              x={x(WINDOW_MINUTES - 1)}
              y={y(stats.plateauP95) - 8}
              textAnchor="end"
              fill="var(--color-ok)"
              fontSize="10.5"
              fontFamily="var(--font-mono)"
            >
              plateau {stats.plateauP95.toFixed(1)}ms · n={stats.afterCount}
            </text>

            {/* The ratio */}
            <text
              x={PAD.left + plotW + 8}
              y={y(stats.plateauP95) + 40}
              fill="var(--color-ink)"
              fontSize="19"
              fontFamily="var(--font-mono)"
              fontWeight="500"
            >
              {stats.ratio.toFixed(2)}×
            </text>
            <text
              x={PAD.left + plotW + 8}
              y={y(stats.plateauP95) + 54}
              fill="var(--color-dim)"
              fontSize="9.5"
              fontFamily="var(--font-mono)"
            >
              p95 regression
            </text>
          </>
        ) : null}

        {/* X axis labels */}
        {[0, 15, 30, 45, 60].map((m) => (
          <text
            key={m}
            x={x(m)}
            y={H - 12}
            textAnchor="middle"
            fill="var(--color-dim)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            {new Date(Date.UTC(2026, 7, 25, 14, 30 + m)).toISOString().slice(11, 16)}
          </text>
        ))}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-dim">
        <Swatch color="var(--color-steel)" label="p95" />
        <Swatch color="var(--color-muted)" label="p50" />
        <Swatch color="var(--color-line-strong)" label="ramp — excluded from both means" />
        <span className="ml-auto">
          baseline {BASE_P95}ms constant · plateau {Math.round(stats.plateauP95)}ms observed
        </span>
      </figcaption>
    </figure>
  );
};

const Swatch = ({ color, label }: { color: string; label: string }) => {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-0.5 w-4" style={{ background: color }} />
      {label}
    </span>
  );
};
