/**
 * Act I — the problem, and the two ways people get it wrong.
 *
 * The tension this act has to build is not "incidents are hard". It is that the
 * obvious fixes are both worse: reporting leaves you where you started, and
 * autonomy points a language model at production.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { SceneShell, ActMark } from '../components/SceneShell';
import { Headline, Eyebrow, Body, WordReveal } from '../components/Type';
import { Sfx, SfxSeries } from '../components/Sfx';
import { ease, fade, rand } from '../lib/anim';
import { cue } from '../lib/timeline';

/** The five tabs an engineer actually opens, and what each one costs. */
const TABS = [
  { name: 'grafana / checkout-api', detail: 'is it really up?' },
  { name: 'deploys — last 6 hours', detail: 'what changed?' },
  { name: 'github · compare', detail: 'what is in the diff?' },
  { name: 'terminal — python3', detail: 'is it big enough to matter?' },
  { name: 'incident channel', detail: 'who else is on this?' },
];

export const ProblemTabs = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.7}>
      <ActMark act="01" title="the problem" />
      <SfxSeries name="tick" start={10} every={11} count={5} volume={0.16} />

      <Headline delay={0} style={{ maxWidth: 1400, marginBottom: 64 }}>
        A production incident is five open tabs.
      </Headline>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 1180 }}>
        {TABS.map((tab, i) => {
          const at = 10 + i * 11;
          const s = ease(frame, at);
          // Each tab drifts a little, so the stack reads as clutter accumulating.
          const skew = (rand(i + 4) - 0.5) * 1.4;
          return (
            <div
              key={tab.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '22px 30px',
                borderRadius: 12,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.surface,
                opacity: s * (0.55 + i * 0.11),
                transform: `translateX(${(1 - s) * -40}px) rotate(${skew * s}deg)`,
              }}
            >
              <span style={{ fontFamily: FONTS.mono, fontSize: 27, color: COLORS.ink }}>
                {tab.name}
              </span>
              <span style={{ fontFamily: FONTS.sans, fontSize: 24, color: COLORS.dim }}>
                {tab.detail}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 54, opacity: fade(frame, 74, 90) }}>
        <Eyebrow delay={74} color={COLORS.danger}>
          and a clock running the whole time
        </Eyebrow>
      </div>
    </SceneShell>
  );
};

export const ProblemSplit = () => {
  const frame = useCurrentFrame();
  const c = cue('ProblemSplit', 'prob-03');

  return (
    <SceneShell intensity={0.6}>
      <ActMark act="01" title="the problem" />
      <Sfx name="impact" at={c - 2} volume={0.36} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'center' }}>
        <WordReveal
          text="The investigation is mechanical."
          delay={c - 2}
          size={80}
          color={COLORS.muted}
        />
        <WordReveal
          text="The decision is not."
          delay={c + 22}
          size={80}
          color={COLORS.ink}
        />
      </div>

      {/* A single dividing line: the whole thesis, drawn once. */}
      <div
        style={{
          marginTop: 62,
          width: 900 * ease(frame, c + 44),
          height: 2,
          background: `linear-gradient(90deg, ${COLORS.steel}, ${COLORS.gate})`,
          opacity: fade(frame, c + 44, c + 58) * 0.8,
        }}
      />
    </SceneShell>
  );
};

/** The two failure modes, shown as two doors that are both wrong. */
export const TwoFailures = () => {
  const frame = useCurrentFrame();
  const cA = cue('TwoFailures', 'prob-04');
  const cB = cue('TwoFailures', 'prob-05');

  const Card = ({
    at,
    label,
    title,
    body,
    accent,
    verdict,
  }: {
    at: number;
    label: string;
    title: string;
    body: string;
    accent: string;
    verdict: string;
  }) => {
    const s = ease(frame, at);
    return (
      <div
        style={{
          width: 660,
          padding: '46px 44px',
          borderRadius: 16,
          border: `1px solid ${accent}55`,
          background: `linear-gradient(180deg, ${accent}0d, ${COLORS.surface})`,
          opacity: s,
          transform: `translateY(${(1 - s) * 26}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 18,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          {label}
        </div>
        <div style={{ fontFamily: FONTS.sans, fontSize: 44, fontWeight: 600, color: COLORS.ink }}>
          {title}
        </div>
        <div style={{ fontFamily: FONTS.sans, fontSize: 27, color: COLORS.muted, lineHeight: 1.45 }}>
          {body}
        </div>
        <div
          style={{
            marginTop: 12,
            paddingTop: 20,
            borderTop: `1px solid ${COLORS.line}`,
            fontFamily: FONTS.mono,
            fontSize: 22,
            color: accent,
            opacity: fade(frame, at + 18, at + 30),
          }}
        >
          {verdict}
        </div>
      </div>
    );
  };

  return (
    <SceneShell intensity={0.65} glow={COLORS.danger}>
      <ActMark act="01" title="the problem" />
      <Sfx name="whoosh" at={cA - 4} volume={0.24} />
      <Sfx name="whoosh" at={cB - 4} volume={0.24} />

      <Eyebrow delay={0} style={{ marginBottom: 46 }}>
        two directions, both wrong
      </Eyebrow>

      <div style={{ display: 'flex', gap: 40 }}>
        <Card
          at={cA + 6}
          label="failure one"
          title="It only reports."
          body="A dashboard summariser. It restates what you could already see, and every decision is still yours to make from scratch."
          accent={COLORS.muted}
          verdict="→ you are exactly where you started"
        />
        <Card
          at={cB + 4}
          label="failure two"
          title="It acts alone."
          body="Now an inference — a probabilistic guess about a system it cannot see all of — is wired straight into your production control plane."
          accent={COLORS.danger}
          verdict="→ the blast radius is production"
        />
      </div>
    </SceneShell>
  );
};

export const Stakes = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.5} glow={COLORS.danger}>
      <Sfx name="riser" at={0} volume={0.3} />
      <Sfx name="impact" at={44} volume={0.5} />

      <WordReveal
        text="Give a model a rollback button"
        delay={2}
        size={76}
        color={COLORS.muted}
        style={{ maxWidth: 1500 }}
      />
      <div style={{ height: 26 }} />
      <WordReveal
        text="and you have automated the most expensive mistake available to it."
        delay={30}
        size={76}
        color={COLORS.ink}
        style={{ maxWidth: 1560 }}
      />

      {/* The line thickens and turns as the sentence lands. */}
      <div
        style={{
          marginTop: 66,
          width: 1000,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${COLORS.danger}, transparent)`,
          opacity: fade(frame, 52, 68) * 0.9,
          transform: `scaleX(${ease(frame, 52)})`,
        }}
      />

      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 520px at 50% 55%, ${COLORS.danger}14, transparent 70%)`,
          opacity: fade(frame, 44, 62),
          pointerEvents: 'none',
        }}
      />
    </SceneShell>
  );
};
