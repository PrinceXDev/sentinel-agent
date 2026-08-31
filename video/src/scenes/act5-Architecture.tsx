/**
 * Act V — under the hood.
 *
 * The architecture is revealed progressively, never dumped: three boxes, then
 * the tool surface, then the credential boundary. The act's real subject is the
 * annotation bug — the one place where a correct-looking tool, a correct-looking
 * agent config and a correct-looking review still produce an ungated rollback.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { SceneShell, ActMark } from '../components/SceneShell';
import { Eyebrow, Headline, Body, WordReveal } from '../components/Type';
import { Shot } from '../components/Shot';
import { Diagram, type NodeSpec, type EdgeSpec } from '../components/Diagram';
import { Sfx, SfxSeries } from '../components/Sfx';
import { ease, fade } from '../lib/anim';
import { cue } from '../lib/timeline';

/** Three boxes. The simplest true statement about what runs where. */
export const ArchBuild = () => {
  const nodes: NodeSpec[] = [
    { id: 'ui', x: 350, y: 40, w: 300, h: 62, title: 'sentinel-agent UI', sub: ['a view over harness events'], at: 4, accent: COLORS.steel },
    {
      id: 'harness',
      x: 300,
      y: 200,
      w: 400,
      h: 76,
      title: 'TRUEFORGE HARNESS',
      sub: ['agent loop · tool routing', 'APPROVAL GATING'],
      at: 22,
      accent: COLORS.gate,
      tint: `${COLORS.gate}12`,
    },
    { id: 'agent', x: 350, y: 396, w: 300, h: 62, title: 'sentinel-agent', sub: ['runs inside the harness'], at: 40, accent: COLORS.steel },
  ];
  const edges: EdgeSpec[] = [
    { from: [500, 102], to: [500, 198], at: 18, pulse: true },
    { from: [500, 276], to: [500, 394], at: 36, pulse: true },
  ];

  return (
    <SceneShell intensity={0.55} padding={80}>
      <ActMark act="04" title="under the hood" />
      <SfxSeries name="tick" start={6} every={18} count={3} volume={0.15} />

      <Eyebrow delay={0} style={{ marginBottom: 24 }}>
        where the gate actually lives
      </Eyebrow>
      <Diagram nodes={nodes} edges={edges} width={1080} />
      <Body delay={46} style={{ marginTop: 10, maxWidth: 1100 }}>
        The agent does not decide whether to pause. The layer it runs inside decides,
        and there is no code path from the agent to the other side of it.
      </Body>
    </SceneShell>
  );
};

/** The full picture, including the credential boundary. */
export const ArchFull = () => {
  const frame = useCurrentFrame();
  const c3 = cue('ArchFull', 'arch-03');

  const nodes: NodeSpec[] = [
    { id: 'ui', x: 350, y: 14, w: 300, h: 54, title: 'sentinel-agent UI', sub: ['holds no credential'], at: 2, accent: COLORS.steel },
    {
      id: 'harness',
      x: 210,
      y: 140,
      w: 580,
      h: 76,
      title: 'TRUEFORGE HARNESS',
      sub: ['approval gating · subagents · sandbox · sessions', 'HOLDS EVERY CREDENTIAL'],
      at: 6,
      accent: COLORS.gate,
      tint: `${COLORS.gate}12`,
    },
    {
      id: 'mcp',
      x: 30,
      y: 320,
      w: 290,
      h: 84,
      title: 'sentinel-ops MCP',
      sub: ['8 read-only · autonomous', '5 write/destroy · GATED'],
      at: 16,
      accent: COLORS.steel,
    },
    {
      id: 'subs',
      x: 355,
      y: 320,
      w: 290,
      h: 84,
      title: 'subagents',
      sub: ['isolated contexts', 'conclusions only'],
      at: 24,
    },
    {
      id: 'sandbox',
      x: 680,
      y: 320,
      w: 290,
      h: 84,
      title: 'sandbox · python 3.13',
      sub: ['pandas · no Node runtime', 'holds no credential'],
      at: 32,
    },
  ];

  const edges: EdgeSpec[] = [
    { from: [500, 68], to: [500, 138], at: 4, pulse: true },
    { from: [420, 216], to: [180, 318], at: 14, label: 'mcp', pulse: true },
    { from: [500, 216], to: [500, 318], at: 22, label: 'delegate', pulse: true },
    { from: [590, 216], to: [820, 318], at: 30, label: 'exec', pulse: true },
  ];

  return (
    <SceneShell intensity={0.6} padding={70}>
      <ActMark act="04" title="under the hood" />
      <SfxSeries name="tick" start={6} every={8} count={4} volume={0.13} />

      <Diagram nodes={nodes} edges={edges} width={1400} />

      {/* The credential boundary drawn as a literal ring around the harness. */}
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          gap: 44,
          opacity: fade(frame, c3, c3 + 14),
        }}
      >
        {['UI holds none', 'MCP server holds none', 'sandbox holds none'].map((t, i) => (
          <div
            key={t}
            style={{
              padding: '14px 24px',
              borderRadius: 999,
              border: `1px solid ${COLORS.ok}44`,
              background: `${COLORS.ok}0d`,
              fontFamily: FONTS.mono,
              fontSize: 21,
              color: COLORS.ok,
              opacity: fade(frame, c3 + i * 6, c3 + 14 + i * 6),
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

export const BugReveal = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.5} glow={COLORS.danger}>
      <Sfx name="riser" at={0} volume={0.3} />
      <Sfx name="impact" at={34} volume={0.44} />

      <WordReveal
        text="There is a bug in this design."
        delay={2}
        size={80}
        color={COLORS.ink}
      />
      <div style={{ height: 30 }} />
      <WordReveal
        text="Not here — in the pattern almost everyone will copy."
        delay={28}
        size={52}
        color={COLORS.danger}
        style={{ maxWidth: 1400 }}
      />
    </SceneShell>
  );
};

/** The real annotated-vs-unannotated diagram from the product's own homepage. */
export const BugDiagram = () => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.55} glow={COLORS.danger} padding={80}>
      <ActMark act="04" title="the annotation bug" />

      <Eyebrow delay={0} style={{ marginBottom: 30 }}>
        same tool · same production system
      </Eyebrow>

      <Shot
        name="annotation"
        width={1640}
        total={durationInFrames}
        delay={2}
        move={{ from: { scale: 1.0 }, to: { scale: 1.05 }, origin: [50, 50] }}
      />

      <div style={{ marginTop: 38, opacity: fade(frame, 40, 56) }}>
        <Body delay={40} style={{ maxWidth: 1200 }}>
          The default policy is <span style={{ fontFamily: FONTS.mono, color: COLORS.ink }}>
            ["@write", "@destructive"]
          </span>. A tool publishing no annotations matches neither — nor even{' '}
          <span style={{ fontFamily: FONTS.mono, color: COLORS.ink }}>@read-only</span>.
        </Body>
      </div>
    </SceneShell>
  );
};

/** The consequence, stated plainly, then twisted. */
export const BugPayoff = () => {
  const frame = useCurrentFrame();
  const c4 = cue('BugPayoff', 'bug-04');

  return (
    <SceneShell intensity={0.58} glow={COLORS.danger}>
      <Sfx name="impact" at={28} volume={0.46} />

      <WordReveal
        text="It matches nothing. So it executes."
        delay={2}
        size={84}
        color={COLORS.danger}
        style={{ maxWidth: 1500 }}
      />

      <div
        style={{
          marginTop: 56,
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          opacity: fade(frame, 30, 44),
        }}
      >
        {['no prompt', 'no pause', 'no record that a pause was skipped'].map((t, i) => (
          <div
            key={t}
            style={{
              padding: '14px 26px',
              borderRadius: 8,
              border: `1px solid ${COLORS.danger}55`,
              background: `${COLORS.danger}0f`,
              fontFamily: FONTS.mono,
              fontSize: 22,
              color: COLORS.danger,
              opacity: fade(frame, 30 + i * 6, 44 + i * 6),
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* The line that makes it frightening rather than merely wrong. */}
      <div style={{ marginTop: 70, opacity: fade(frame, c4, c4 + 14) }}>
        <WordReveal
          text="And nothing in review looks wrong."
          delay={c4}
          size={62}
          color={COLORS.ink}
        />
      </div>
      <div style={{ marginTop: 26, opacity: fade(frame, c4 + 20, c4 + 34) }}>
        <Body delay={c4 + 20} style={{ maxWidth: 1200 }}>
          The tool is correct. The agent config is correct. The gate simply never triggers.
        </Body>
      </div>
    </SceneShell>
  );
};

/** How this repository makes that failure unreachable. */
export const ThreeLayers = () => {
  const frame = useCurrentFrame();

  const LAYERS = [
    {
      n: '01',
      title: 'Structural',
      body: 'Every tool is built through defineTool, which takes risk as a required field and derives the annotations from it. No code path registers a tool without them.',
      accent: COLORS.steel,
    },
    {
      n: '02',
      title: 'Tested',
      body: "registry.test.ts asserts against the harness's own predicates, not our labels. Add a destructive tool without classifying it and CI fails.",
      accent: COLORS.ok,
    },
    {
      n: '03',
      title: 'Belt and braces',
      body: 'The destructive tools are named literally in require_approval_for_tools, so the gate holds even if an SDK version drops annotations in transit.',
      accent: COLORS.gate,
    },
  ];

  return (
    <SceneShell intensity={0.56} padding={80}>
      <ActMark act="04" title="three layers" />
      <SfxSeries name="tick" start={8} every={14} count={3} volume={0.16} />

      <Headline delay={0} style={{ fontSize: 58, marginBottom: 50 }}>
        Three layers make it unreachable here.
      </Headline>

      <div style={{ display: 'flex', gap: 30 }}>
        {LAYERS.map((l, i) => {
          const at = 8 + i * 14;
          const s = ease(frame, at);
          return (
            <div
              key={l.n}
              style={{
                width: 520,
                padding: '38px 36px',
                borderRadius: 16,
                border: `1px solid ${l.accent}44`,
                background: `linear-gradient(180deg, ${l.accent}0a, ${COLORS.surface})`,
                opacity: s,
                transform: `translateY(${(1 - s) * 24}px)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div style={{ fontFamily: FONTS.mono, fontSize: 20, color: l.accent, letterSpacing: '0.2em' }}>
                {l.n}
              </div>
              <div style={{ fontFamily: FONTS.sans, fontSize: 40, fontWeight: 600, color: COLORS.ink }}>
                {l.title}
              </div>
              <div style={{ fontFamily: FONTS.sans, fontSize: 24, lineHeight: 1.5, color: COLORS.muted }}>
                {l.body}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 46,
          fontFamily: FONTS.mono,
          fontSize: 24,
          color: COLORS.ok,
          opacity: fade(frame, 58, 74),
        }}
      >
        13 / 13 tools annotated on the wire · 0 unannotated
      </div>
    </SceneShell>
  );
};
