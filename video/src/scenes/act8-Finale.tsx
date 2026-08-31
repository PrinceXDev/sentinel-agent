/**
 * Act VIII — impact, and the close.
 *
 * The pacing slows to its lowest here. The strongest image comes back, the
 * project is named, one sentence lands, and then a quiet credit card — not a
 * terminal, and not a wall of text.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { SceneShell } from '../components/SceneShell';
import { Eyebrow, Headline, Body, WordReveal, Rule } from '../components/Type';
import { Sfx } from '../components/Sfx';
import { ease, fade, countTo } from '../lib/anim';
import { cue } from '../lib/timeline';

/** The four figures from the product's own guided tour. */
export const Impact = () => {
  const frame = useCurrentFrame();
  const c2 = cue('Impact', 'imp-02');

  const STATS = [
    { v: 0, label: 'clicks to reach a root cause', fmt: (n: number) => String(Math.round(n)) },
    { v: 1, label: 'click to change production', fmt: (n: number) => String(Math.round(n)) },
    { v: 61, label: 'raw samples it had to reduce itself', fmt: (n: number) => String(Math.round(n)) },
    { v: 0.91, label: 'stated confidence, evidence attached', fmt: (n: number) => n.toFixed(2) },
  ];

  return (
    <SceneShell intensity={0.55} padding={90}>
      <Sfx name="tick" at={8} volume={0.16} />
      <Sfx name="tick" at={18} volume={0.16} />

      <Eyebrow delay={0} style={{ marginBottom: 54 }}>
        what actually changes
      </Eyebrow>

      <div style={{ display: 'flex', gap: 70 }}>
        {STATS.map((s, i) => {
          const at = 6 + i * 7;
          return (
            <div
              key={s.label}
              style={{
                width: 340,
                textAlign: 'center',
                opacity: fade(frame, at, at + 14),
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 112,
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  color: i === 1 ? COLORS.gate : COLORS.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.fmt(countTo(frame, at, s.v, 24))}
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontFamily: FONTS.sans,
                  fontSize: 23,
                  lineHeight: 1.4,
                  color: COLORS.dim,
                }}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 76, opacity: fade(frame, c2 - 4, c2 + 12) }}>
        <WordReveal
          text="The one irreversible moment stays where it belongs."
          delay={c2 - 4}
          size={52}
          color={COLORS.ink}
          style={{ maxWidth: 1500 }}
        />
      </div>
    </SceneShell>
  );
};

export const FinaleBuild = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.4} fadeFrames={16}>
      <Sfx name="riser" at={0} volume={0.28} />
      <Sfx name="impact" at={40} volume={0.46} />

      <WordReveal
        text="Autonomy is not the hard problem."
        delay={2}
        size={74}
        color={COLORS.muted}
        per={3.6}
      />
      <div style={{ height: 34 }} />
      <WordReveal
        text="Knowing precisely where to stop is."
        delay={34}
        size={86}
        color={COLORS.ink}
        per={3.6}
      />

      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 520px at 50% 54%, ${COLORS.gate}12, transparent 72%)`,
          opacity: fade(frame, 36, 56),
          pointerEvents: 'none',
        }}
      />
    </SceneShell>
  );
};

export const FinaleLogo = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = ease(frame, 2);
  const sweep = fade(frame, 6, 48);

  return (
    <SceneShell intensity={0.5} glow={COLORS.steel} fadeFrames={14}>
      <Sfx name="gate" at={2} volume={0.38} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 34, alignItems: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 104,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: COLORS.ink,
            opacity: s,
            filter: `blur(${(1 - s) * 14}px)`,
          }}
        >
          sentinel<span style={{ color: COLORS.steel }}>-agent</span>
        </div>

        <AbsoluteFill
          style={{
            background: `linear-gradient(105deg, transparent 43%, ${COLORS.ink}20 50%, transparent 57%)`,
            transform: `translateX(${(sweep - 0.5) * 1500}px)`,
            pointerEvents: 'none',
          }}
        />

        <Rule delay={14} width={820} color={COLORS.lineStrong} />

        <div
          style={{
            display: 'flex',
            gap: 26,
            alignItems: 'center',
            opacity: fade(frame, 20, 36),
          }}
        >
          <span style={{ fontFamily: FONTS.sans, fontSize: 44, color: COLORS.ink }}>
            The agent investigates.
          </span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.gate }} />
          <span style={{ fontFamily: FONTS.sans, fontSize: 44, color: COLORS.gate }}>
            You decide when it acts.
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 88,
          opacity: fade(frame, 40, 56) * fade(frame, durationInFrames - 16, durationInFrames, 1, 0),
        }}
      >
        <Eyebrow delay={40}>sentinel-agent-web.vercel.app</Eyebrow>
      </div>
    </SceneShell>
  );
};

/** The sign-off, and where to find the work and the person who built it. */
export const Credits = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const LINKS = [
    { label: 'live', value: 'sentinel-agent-web.vercel.app' },
    { label: 'code', value: 'github.com/PrinceXDev' },
    { label: 'linkedin', value: 'linkedin.com/in/prince-panchani-70757b202' },
  ];

  return (
    <SceneShell intensity={0.34} glow={COLORS.steel} fadeFrames={20}>
      <Headline delay={2} style={{ fontSize: 84, marginBottom: 20 }}>
        Thank you.
      </Headline>

      <div style={{ opacity: fade(frame, 14, 28), marginBottom: 56 }}>
        <Body delay={14} style={{ fontSize: 28 }}>
          Built for the Agent Harness Hackathon · WeMakeDevs × TrueFoundry
        </Body>
      </div>

      <Rule delay={22} width={760} />

      <div
        style={{
          marginTop: 52,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          alignItems: 'center',
        }}
      >
        {LINKS.map((l, i) => {
          const at = 30 + i * 7;
          return (
            <div
              key={l.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 22,
                opacity: fade(frame, at, at + 14),
              }}
            >
              <span
                style={{
                  width: 110,
                  textAlign: 'right',
                  fontFamily: FONTS.mono,
                  fontSize: 19,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: COLORS.dim,
                }}
              >
                {l.label}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 30, color: COLORS.ink }}>
                {l.value}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 84,
          fontFamily: FONTS.mono,
          fontSize: 20,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: COLORS.dim,
          opacity: fade(frame, 56, 72) * fade(frame, durationInFrames - 26, durationInFrames - 6, 1, 0),
        }}
      >
        Prince Panchani
      </div>
    </SceneShell>
  );
};
