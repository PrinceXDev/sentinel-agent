/**
 * Act 0 — the cold open, and the title.
 *
 * Fifteen seconds to create a question. No logo, no greeting, no "today we are
 * presenting": the film opens inside an incident that is already happening, and
 * the product's name arrives only after the viewer wants it to.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { SceneShell } from '../components/SceneShell';
import { Hero, Eyebrow, WordReveal } from '../components/Type';
import { Sfx } from '../components/Sfx';
import { ease, fade, countTo, rand, wipe } from '../lib/anim';
import { cue } from '../lib/timeline';

const S = 'ColdOpen';

/** The p95 series, as the estate actually generates it: flat, ramp, plateau. */
const seriesY = (i: number, n: number) => {
  const t = i / (n - 1);
  const base = 178;
  const plateau = 658;
  if (t < 0.53) return base + (rand(i) - 0.5) * 9;
  if (t < 0.62) {
    const k = (t - 0.53) / 0.09;
    return base + (plateau - base) * (1 - (1 - k) ** 2);
  }
  return plateau + (rand(i * 3) - 0.5) * 12;
};

/** The alarm line that opens the film, drawn as the chart itself. */
const SpikeChart = ({ startAt }: { startAt: number }) => {
  const frame = useCurrentFrame();
  const N = 61;
  const W = 1380;
  const H = 420;
  const draw = Math.min(1, Math.max(0, (frame - startAt) / 46));

  const pts = Array.from({ length: N }, (_, i) => {
    const x = (i / (N - 1)) * W;
    const y = H - (seriesY(i, N) / 760) * H;
    return [x, y] as const;
  });
  const shown = Math.max(2, Math.floor(pts.length * draw));
  const path = pts
    .slice(0, shown)
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const head = pts[shown - 1];

  // The 400ms budget line, and the moment it is breached.
  const budgetY = H - (400 / 760) * H;
  const breached = draw > 0.6;

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <line
        x1={0}
        y1={budgetY}
        x2={W}
        y2={budgetY}
        stroke={COLORS.danger}
        strokeWidth={1.5}
        strokeDasharray="7 7"
        opacity={0.55}
      />
      <text
        x={W}
        y={budgetY - 12}
        textAnchor="end"
        fontFamily={FONTS.mono}
        fontSize={18}
        fill={COLORS.danger}
        opacity={0.8}
      >
        400ms budget
      </text>
      <path
        d={path}
        fill="none"
        stroke={breached ? COLORS.danger : COLORS.steel}
        strokeWidth={3}
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 18px ${breached ? COLORS.danger : COLORS.steel}88)` }}
      />
      {head ? (
        <circle
          cx={head[0]}
          cy={head[1]}
          r={6}
          fill={breached ? COLORS.danger : COLORS.steel}
          opacity={0.9}
        />
      ) : null}
    </svg>
  );
};

export const ColdOpen = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const c1 = cue(S, 'cold-01');
  const c2 = cue(S, 'cold-02');
  const c3 = cue(S, 'cold-03');
  const c4 = cue(S, 'cold-04');

  // The number climbs while the line draws, and lands on the real figure.
  const ratio = countTo(frame, c1 + 4, 3.7, 34);

  return (
    <SceneShell intensity={0.85} glow={COLORS.danger} fadeFrames={0} padding={0}>
      <Sfx name="alert" at={2} />
      <Sfx name="impact" at={c1 + 2} volume={0.42} />
      <Sfx name="whoosh" at={c3 - 6} />

      {/* 1 — the alarm */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 34,
          opacity: fade(frame, c2 + 34, c2 + 52, 1, 0),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 26, opacity: ease(frame, 0) }}>
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: COLORS.danger,
              opacity: 0.5 + 0.5 * Math.sin(frame / 5),
              alignSelf: 'center',
            }}
          />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              letterSpacing: '0.26em',
              textTransform: 'uppercase',
              color: COLORS.danger,
            }}
          >
            INC-2048 · checkout-api · p95 latency
          </span>
        </div>

        <SpikeChart startAt={4} />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 22 }}>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 168,
              fontWeight: 600,
              letterSpacing: '-0.04em',
              color: COLORS.ink,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {ratio.toFixed(2)}×
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 26,
              color: COLORS.muted,
              opacity: fade(frame, c1 + 20, c1 + 32),
            }}
          >
            178ms → 658ms
          </span>
        </div>
      </AbsoluteFill>

      {/* 2 — four candidate deployments, none of them accused */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 46,
          opacity: Math.min(
            fade(frame, c2 + 30, c2 + 46),
            fade(frame, c3 + 30, c3 + 46, 1, 0),
          ),
        }}
      >
        <Eyebrow delay={c2 + 32} color={COLORS.muted}>
          four deployments in the window
        </Eyebrow>
        <div style={{ display: 'flex', gap: 26 }}>
          {['dpl-4c18', 'dpl-4c19', 'dpl-4c20', 'dpl-4c21'].map((id, i) => {
            const s = ease(frame, c2 + 40 + i * 4);
            return (
              <div
                key={id}
                style={{
                  padding: '30px 42px',
                  borderRadius: 12,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surface,
                  fontFamily: FONTS.mono,
                  fontSize: 32,
                  color: COLORS.muted,
                  opacity: s,
                  transform: `translateY(${(1 - s) * 20}px)`,
                }}
              >
                {id}
                <div
                  style={{
                    fontSize: 17,
                    color: COLORS.dim,
                    marginTop: 10,
                    letterSpacing: '0.16em',
                  }}
                >
                  ?
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* 3 — the promise, and the reversal */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          opacity: fade(frame, c3 + 26, c3 + 42),
        }}
      >
        <WordReveal
          text="An agent could find it in ninety seconds."
          delay={c3 + 30}
          size={70}
          color={COLORS.muted}
          style={{ maxWidth: 1300 }}
        />
        <div style={{ opacity: fade(frame, c4 - 4, c4 + 8) }}>
          <Hero delay={c4 - 4} color={COLORS.ink} style={{ fontSize: 104 }}>
            That is the <span style={{ color: COLORS.danger }}>easy half.</span>
          </Hero>
        </div>
      </AbsoluteFill>

      {/* The cut to the title, as a hard wipe rather than a dissolve. */}
      <AbsoluteFill
        style={{
          background: COLORS.ground,
          clipPath: wipe(fade(frame, durationInFrames - 12, durationInFrames), 'up'),
        }}
      />
    </SceneShell>
  );
};

export const TitleCard = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = ease(frame, 4);
  const sweep = fade(frame, 8, 46);

  return (
    <SceneShell intensity={0.5} glow={COLORS.steel} fadeFrames={8}>
      <Sfx name="impact" at={3} volume={0.55} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 30 }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 96,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: COLORS.ink,
            opacity: s,
            filter: `blur(${(1 - s) * 12}px)`,
            transform: `scale(${0.98 + s * 0.02})`,
          }}
        >
          sentinel<span style={{ color: COLORS.steel }}>-agent</span>
        </div>

        {/* A light sweep across the wordmark, once. */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(105deg, transparent 42%, ${COLORS.ink}22 50%, transparent 58%)`,
            transform: `translateX(${(sweep - 0.5) * 1400}px)`,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            height: 1,
            background: COLORS.lineStrong,
            width: 700 * ease(frame, 12),
            alignSelf: 'center',
          }}
        />
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 36,
            color: COLORS.muted,
            textAlign: 'center',
            opacity: fade(frame, 16, 30),
          }}
        >
          Autonomous incident response. Human-controlled execution.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 92,
          opacity: fade(frame, 26, 42) * fade(frame, durationInFrames - 14, durationInFrames, 1, 0),
        }}
      >
        <Eyebrow delay={26}>built on the TrueForge agent harness</Eyebrow>
      </div>
    </SceneShell>
  );
};
