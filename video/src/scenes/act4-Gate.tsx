/**
 * Act IV — the gate.
 *
 * The most important thirty seconds in the film, and the only place amber is
 * allowed on screen. Every other act has been building a case; this is where the
 * agent, holding a complete one, refuses to act on it.
 *
 * The pacing here is deliberately the slowest in the piece. The product's claim
 * is that it stops — so the film stops too, rather than describing a stop.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { SceneShell, ActMark } from '../components/SceneShell';
import { Eyebrow, Headline, Body, WordReveal } from '../components/Type';
import { Shot } from '../components/Shot';
import { PipelineStep, PipelineArrow } from '../components/Diagram';
import { Sfx } from '../components/Sfx';
import { ease, fade } from '../lib/anim';
import { cue } from '../lib/timeline';

/** The agent's own pipeline, running right up to the boundary. */
export const GateApproach = () => {
  const frame = useCurrentFrame();

  const STEPS = [
    'incident',
    'evidence',
    'sandbox',
    'mechanism',
    'finding',
    'second opinion',
  ];

  return (
    <SceneShell intensity={0.55} padding={90}>
      <ActMark act="03" title="the gate" />
      <Sfx name="tick" at={4} />

      <Eyebrow delay={0} style={{ marginBottom: 44 }}>
        everything the agent can do on its own authority
      </Eyebrow>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1700 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PipelineStep label={s} at={4 + i * 5} accent={COLORS.steel} />
            {i < STEPS.length - 1 ? <PipelineArrow at={8 + i * 5} /> : null}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 74,
          display: 'flex',
          gap: 70,
          opacity: fade(frame, 40, 54),
        }}
      >
        {[
          ['confidence', '0.91'],
          ['evidence sources', 'attached'],
          ['reversibility', 'reversible'],
        ].map(([k, v], i) => (
          <div key={k} style={{ textAlign: 'center', opacity: fade(frame, 40 + i * 5, 54 + i * 5) }}>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 62,
                fontWeight: 600,
                color: COLORS.ink,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 18,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: COLORS.dim,
                marginTop: 10,
              }}
            >
              {k}
            </div>
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

/** The stop itself. One word, and the film's only full-frame colour change. */
export const GateHold = () => {
  const frame = useCurrentFrame();
  const s = ease(frame, 2);
  const ring = ease(frame, 6);

  return (
    <SceneShell intensity={0.3} glow={COLORS.gate} fadeFrames={6}>
      <Sfx name="gate" at={2} volume={0.5} />

      {/* A ring that closes, rather than an icon that appears. */}
      <svg width={260} height={260} style={{ marginBottom: 46 }}>
        <circle
          cx={130}
          cy={130}
          r={104}
          fill="none"
          stroke={COLORS.gateDim}
          strokeWidth={3}
          opacity={s}
        />
        <circle
          cx={130}
          cy={130}
          r={104}
          fill="none"
          stroke={COLORS.gate}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={653}
          strokeDashoffset={653 * (1 - ring)}
          transform="rotate(-90 130 130)"
          style={{ filter: `drop-shadow(0 0 22px ${COLORS.gate}88)` }}
        />
        {/* A pause glyph. Two bars, nothing more. */}
        <g opacity={fade(frame, 14, 26)}>
          <rect x={112} y={104} width={13} height={52} rx={3} fill={COLORS.gate} />
          <rect x={136} y={104} width={13} height={52} rx={3} fill={COLORS.gate} />
        </g>
      </svg>

      <WordReveal
        text="And this is where it stops."
        delay={12}
        size={92}
        color={COLORS.ink}
        per={4}
      />

      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 540px at 50% 46%, ${COLORS.gate}12, transparent 70%)`,
          opacity: fade(frame, 4, 22),
          pointerEvents: 'none',
        }}
      />
    </SceneShell>
  );
};

/** The real approval card, from the deployed product. */
export const GateCard = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const c4 = cue('GateCard', 'gate-04');

  return (
    <SceneShell intensity={0.4} glow={COLORS.gate} padding={64}>
      <ActMark act="03" title="the gate" />

      <Shot
        name="gate"
        width={1180}
        total={durationInFrames}
        delay={2}
        accent={`${COLORS.gate}55`}
        // Almost still. A push-in crops inside the shot's own box, and the one
        // element that must never be cropped here is the Approve button.
        move={{ from: { scale: 1.0 }, to: { scale: 1.018 }, origin: [50, 50] }}
      />

      <div
        style={{
          marginTop: 30,
          display: 'flex',
          gap: 20,
          opacity: fade(frame, 20, 34),
        }}
      >
        {['action', 'target', 'evidence', 'mechanism', 'expected effect', 'risk', 'reversibility'].map(
          (f, i) => (
            <div
              key={f}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 19,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: COLORS.gate,
                opacity: fade(frame, 20 + i * 3, 32 + i * 3) * 0.85,
              }}
            >
              {f}
            </div>
          ),
        )}
      </div>

      <div style={{ marginTop: 28, opacity: fade(frame, c4 - 2, c4 + 12) }}>
        <WordReveal
          text="Nothing happens until a human chooses."
          delay={c4 - 2}
          size={48}
          color={COLORS.ink}
        />
      </div>
    </SceneShell>
  );
};

/**
 * The wait.
 *
 * A held turn is invisible, so the film gives it a clock and then runs the clock
 * fast — which is the only honest way to show duration without spending it.
 */
export const GateWait = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const c3 = cue('GateWait', 'wait-03');

  // Real time for a beat, then a hard acceleration into a plausible wait. The
  // curve is anchored to the scene length so the clock always lands on the same
  // figure — a little over forty minutes — however the narration is re-cut.
  const fastFrom = 40;
  const MAX_SECONDS = 2_620;
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  const elapsed =
    frame < fastFrom ? frame / 30 : Math.max(frame / 30, MAX_SECONDS * progress ** 2.3);
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const fast = frame > fastFrom;

  return (
    <SceneShell intensity={0.26} glow={COLORS.gate} fadeFrames={16}>
      <Sfx name="tick" at={6} volume={0.14} />
      <Sfx name="whoosh" at={fastFrom} volume={0.2} playbackRate={0.7} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          marginBottom: 40,
          opacity: fade(frame, 0, 12),
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: COLORS.gate,
            opacity: 0.45 + 0.55 * Math.sin(frame / 9),
          }}
        />
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: COLORS.gate,
          }}
        >
          held — awaiting a human
        </span>
      </div>

      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 176,
          fontWeight: 500,
          color: COLORS.ink,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          // A faint motion smear once the clock runs away.
          filter: fast ? `blur(${Math.min(2.6, (frame - fastFrom) / 34)}px)` : 'none',
        }}
      >
        {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
      </div>

      <div
        style={{
          marginTop: 14,
          fontFamily: FONTS.mono,
          fontSize: 20,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: fast ? COLORS.steel : COLORS.dim,
          opacity: fade(frame, fastFrom, fastFrom + 12),
        }}
      >
        ▶▶ fast-forward
      </div>

      <div
        style={{
          marginTop: 62,
          display: 'flex',
          gap: 54,
          opacity: fade(frame, 14, 30),
        }}
      >
        {[
          'no timeout',
          'no default-allow',
          'session persisted',
        ].map((t, i) => (
          <div
            key={t}
            style={{
              fontFamily: FONTS.sans,
              fontSize: 30,
              color: i === 2 ? COLORS.ink : COLORS.muted,
              opacity: fade(frame, 14 + i * 8, 30 + i * 8),
            }}
          >
            {t}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, opacity: fade(frame, c3 + 10, c3 + 24) }}>
        <Body delay={c3 + 10} style={{ maxWidth: 1050 }}>
          Reload the page mid-investigation and the run is still there, still holding,
          with the pending call recovered from the turn.
        </Body>
      </div>
    </SceneShell>
  );
};

/** The pivot into the technical act — framed as something to do while waiting. */
export const CutAway = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.42} fadeFrames={14}>
      <Sfx name="riser" at={0} volume={0.26} />
      <Sfx name="impact" at={40} volume={0.4} />

      <Eyebrow delay={0} color={COLORS.gate} style={{ marginBottom: 34 }}>
        the gate is still holding
      </Eyebrow>

      <WordReveal
        text="So while it waits —"
        delay={4}
        size={72}
        color={COLORS.muted}
      />
      <div style={{ height: 22 }} />
      <WordReveal
        text="what makes that pause worth trusting?"
        delay={26}
        size={72}
        color={COLORS.ink}
        style={{ maxWidth: 1500 }}
      />

      <div
        style={{
          marginTop: 66,
          width: 760 * ease(frame, 44),
          height: 1,
          background: `linear-gradient(90deg, transparent, ${COLORS.steel}, transparent)`,
          opacity: fade(frame, 44, 58),
        }}
      />
    </SceneShell>
  );
};
