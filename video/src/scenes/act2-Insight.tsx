/**
 * Act II — the insight.
 *
 * The slowest act in the film. Everything else is arrangement; this is the idea,
 * and it gets held on screen with almost nothing competing for attention. The
 * split itself is drawn as a literal division of one bar into two halves, which
 * is the image the rest of the film keeps returning to.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { SceneShell } from '../components/SceneShell';
import { Eyebrow, WordReveal } from '../components/Type';
import { Sfx } from '../components/Sfx';
import { ease, fade } from '../lib/anim';
import { cue } from '../lib/timeline';

const S = 'InsightSplit';

export const InsightSplit = () => {
  const frame = useCurrentFrame();
  const cSplit = cue(S, 'ins-02');

  // The bar starts whole, then parts down the middle.
  const part = ease(frame, cSplit - 4);
  const gap = part * 80;

  const Half = ({
    side,
    label,
    caption,
    accent,
  }: {
    side: 'left' | 'right';
    label: string;
    caption: string;
    accent: string;
  }) => (
    <div
      style={{
        width: 620,
        display: 'flex',
        flexDirection: 'column',
        alignItems: side === 'left' ? 'flex-end' : 'flex-start',
        gap: 22,
        transform: `translateX(${side === 'left' ? -gap : gap}px)`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: 12,
          borderRadius: 6,
          background: accent,
          opacity: 0.85,
          boxShadow: `0 0 46px ${accent}66`,
        }}
      />
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 54,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: COLORS.ink,
          opacity: fade(frame, cSplit + 6, cSplit + 20),
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 22,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: accent,
          opacity: fade(frame, cSplit + 14, cSplit + 28),
        }}
      >
        {caption}
      </div>
    </div>
  );

  return (
    <SceneShell intensity={0.4} fadeFrames={18}>
      <Sfx name="whoosh" at={cSplit - 8} volume={0.26} />
      <Sfx name="impact" at={cSplit - 2} volume={0.34} />

      <Eyebrow delay={0} style={{ marginBottom: 70 }}>
        the insight
      </Eyebrow>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <Half
          side="left"
          label="Investigation"
          caption="automated"
          accent={COLORS.steel}
        />
        <div style={{ width: 4 }} />
        <Half side="right" label="Execution" caption="authorised" accent={COLORS.gate} />
      </div>

      {/* The seam. It only exists once the bar has parted. */}
      <div
        style={{
          marginTop: -118,
          width: 2,
          height: 150 * part,
          background: `linear-gradient(180deg, ${COLORS.lineStrong}, transparent)`,
          opacity: part,
        }}
      />

      <div style={{ marginTop: 40, opacity: fade(frame, cSplit + 24, cSplit + 40) }}>
        <Eyebrow delay={cSplit + 24} color={COLORS.muted}>
          split the job where the risk actually changes
        </Eyebrow>
      </div>
    </SceneShell>
  );
};

export const InsightPayoff = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.42} fadeFrames={16}>
      <Sfx name="impact" at={26} volume={0.4} />

      <WordReveal
        text="That split is not a feature of the product."
        delay={2}
        size={68}
        color={COLORS.muted}
        style={{ maxWidth: 1500 }}
      />
      <div style={{ height: 30 }} />
      <WordReveal text="It is the product." delay={26} size={92} color={COLORS.ink} />

      <AbsoluteFill
        style={{
          background: `radial-gradient(760px 440px at 50% 56%, ${COLORS.steel}14, transparent 72%)`,
          opacity: fade(frame, 26, 46),
          pointerEvents: 'none',
        }}
      />
    </SceneShell>
  );
};
