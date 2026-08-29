'use client';

/**
 * Two confidence numbers on one dial.
 *
 * The inner arc is the investigating agent's own confidence. The outer, thinner
 * arc is the independent auditor's — formed from the evidence alone, without
 * being told what the investigation concluded.
 *
 * Drawing them concentrically rather than side by side is the whole design
 * decision. Two separate numbers read as two facts; two arcs on one dial read as
 * *one claim and its second opinion*, and the gap between them is visible before
 * either number is. When they diverge by twenty points or more the dial says so
 * in words, because that gap means the investigation convinced itself of
 * something its own evidence does not carry — and an approver who misses that
 * has been handed a number rather than a judgement.
 *
 * Before the audit arrives, the outer track is drawn empty and labelled
 * "unaudited". A single confident arc with nothing beside it would imply the
 * conclusion had been checked when it has not.
 */

import type { Finding } from '@/lib/estate';

/** Below this, the skill instructs the agent to gather evidence rather than act. */
const ACT_THRESHOLD = 80;
/** At or above this gap, the two views are treated as being in conflict. */
const DIVERGENCE = 20;

const toneFor = (value: number): string => {
  if (value >= ACT_THRESHOLD) return 'var(--color-ok)';
  if (value >= 60) return 'var(--color-gate)';
  return 'var(--color-danger)';
};

const textToneFor = (value: number): string => {
  if (value >= ACT_THRESHOLD) return 'text-ok';
  if (value >= 60) return 'text-gate';
  return 'text-danger';
};

interface ConfidenceMeterProps {
  finding: Finding;
  /** `full` for the root-cause panel, `compact` for the approval card. */
  size?: 'full' | 'compact';
}

export const ConfidenceMeter = ({ finding, size = 'full' }: ConfidenceMeterProps) => {
  const { confidence, audit } = finding;
  const compact = size === 'compact';

  // A 240° sweep starting from the lower-left, so the gap sits at the bottom
  // where the numeral goes. Radii are chosen so the two arcs read as related
  // without the outer one looking like a border.
  const box = compact ? 92 : 128;
  const centre = box / 2;
  const outerR = compact ? 38 : 54;
  const innerR = compact ? 29 : 42;
  const sweep = 240;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: box, height: box }}>
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          // Rotate so the 240° sweep is centred on the bottom gap.
          style={{ transform: 'rotate(150deg)' }}
          aria-hidden="true"
        >
          <title>Confidence</title>

          {/* Investigator — inner, heavier. */}
          <Arc r={innerR} centre={centre} sweep={sweep} width={compact ? 5 : 7} track />
          <Arc
            r={innerR}
            centre={centre}
            sweep={sweep}
            width={compact ? 5 : 7}
            value={confidence}
            colour={toneFor(confidence)}
          />

          {/* Auditor — outer, lighter. Track only when unaudited. */}
          <Arc r={outerR} centre={centre} sweep={sweep} width={compact ? 2 : 3} track />
          {audit && (
            <Arc
              r={outerR}
              centre={centre}
              sweep={sweep}
              width={compact ? 2 : 3}
              value={audit.confidence}
              colour="var(--color-audit)"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`tnum font-mono font-medium leading-none ${textToneFor(confidence)} ${
              compact ? 'text-lg' : 'text-2xl'
            }`}
          >
            {Math.round(confidence)}
            <span className="text-dim text-xs">%</span>
          </span>
          {!compact && <span className="eyebrow mt-1">confidence</span>}
        </div>
      </div>

      <Readings finding={finding} />
    </div>
  );
};

/** The numeric legend beside the dial, and the divergence note when there is one. */
const Readings = ({ finding }: { finding: Finding }) => {
  const { confidence, audit } = finding;
  const delta = audit ? audit.confidence - confidence : null;
  const diverges = delta !== null && Math.abs(delta) >= DIVERGENCE;

  return (
    <dl className="flex min-w-0 flex-col gap-2">
      <Reading
        label="investigator"
        value={`${Math.round(confidence)}%`}
        swatch={toneFor(confidence)}
        tone={textToneFor(confidence)}
      />

      {audit ? (
        <Reading
          label={audit.auditor}
          value={`${Math.round(audit.confidence)}%`}
          swatch="var(--color-audit)"
          tone="text-audit"
        />
      ) : (
        <Reading
          label="auditor"
          value="unaudited"
          swatch="var(--color-line-strong)"
          tone="text-dim"
        />
      )}

      {delta !== null && (
        <div
          className={`mt-0.5 border-l-2 pl-2 ${diverges ? 'border-danger' : 'border-line-strong'}`}
        >
          <span className={`tnum font-mono text-xs ${diverges ? 'text-danger' : 'text-muted'}`}>
            {delta > 0 ? '+' : ''}
            {Math.round(delta)} pts
          </span>
          <p className={`text-[0.7rem] leading-snug ${diverges ? 'text-danger' : 'text-dim'}`}>
            {diverges
              ? 'The two views disagree. Read the audit before deciding.'
              : 'Independent review broadly agrees.'}
          </p>
        </div>
      )}
    </dl>
  );
};

/**
 * One arc of the dial.
 *
 * `pathLength={100}` normalises the geometry so the dash array can be written in
 * percentage points directly — the arc's real length in user units never has to
 * be computed to make 73% cover 73% of the sweep.
 */
const Arc = ({
  r,
  centre,
  sweep,
  width,
  value = 100,
  colour,
  track = false,
}: {
  r: number;
  centre: number;
  sweep: number;
  width: number;
  value?: number;
  colour?: string;
  track?: boolean;
}) => {
  // Rounded to three decimals because `Math.cos`/`Math.sin` are not required to
  // be bit-identical across implementations, and Node and the browser disagree in
  // the last digit — enough for React to report a hydration mismatch on the `d`
  // attribute and abandon patching this subtree. Three decimals is far finer than
  // a device pixel at this radius.
  const end = (sweep * Math.PI) / 180;
  const x = (centre + r * Math.cos(end)).toFixed(3);
  const y = (centre + r * Math.sin(end)).toFixed(3);
  const d = `M ${centre + r} ${centre} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x} ${y}`;

  return (
    <path
      d={d}
      fill="none"
      stroke={track ? 'var(--color-line)' : colour}
      strokeWidth={width}
      strokeLinecap="round"
      pathLength={100}
      strokeDasharray={track ? undefined : `${Math.max(0, Math.min(100, value))} 100`}
      className={track ? undefined : 'arc-draw'}
      style={track ? undefined : ({ '--arc-length': '100' } as React.CSSProperties)}
    />
  );
};

const Reading = ({
  label,
  value,
  swatch,
  tone,
}: {
  label: string;
  value: string;
  swatch: string;
  tone: string;
}) => {
  return (
    <div className="flex items-baseline gap-2">
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: swatch }}
      />
      <dt className="eyebrow truncate">{label}</dt>
      <dd className={`tnum ml-auto font-mono text-xs ${tone}`}>{value}</dd>
    </div>
  );
};
