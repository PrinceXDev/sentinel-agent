/**
 * Act III — the product.
 *
 * Every panel in this act is a real screenshot of the deployed sentinel-agent
 * site, captured by `npm run capture`. Nothing is recreated. What the film adds
 * is a camera: the whole panel, then a push into the one row that matters, then
 * out again — so the viewer always knows what they are looking at and why.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { SceneShell, ActMark } from '../components/SceneShell';
import { Eyebrow, Headline, Body, WordReveal } from '../components/Type';
import { Shot, ShotCrop, Highlight } from '../components/Shot';
import { PipelineStep, PipelineArrow } from '../components/Diagram';
import { Sfx, SfxSeries } from '../components/Sfx';
import { ease, fade, countTo, rand } from '../lib/anim';
import { cue } from '../lib/timeline';

export const RunTimeline = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const c2 = cue('RunTimeline', 'prod-02');

  return (
    <SceneShell intensity={0.6} padding={90}>
      <ActMark act="02" title="the run" />
      <SfxSeries name="tick" start={c2 + 6} every={9} count={5} volume={0.15} />

      <Eyebrow delay={0} style={{ marginBottom: 30 }}>
        real run · real tools · real estate
      </Eyebrow>

      <Shot
        name="timeline"
        width={1120}
        total={durationInFrames}
        delay={4}
        move={{ from: { scale: 1.0 }, to: { scale: 1.05 }, origin: [50, 34] }}
      >
        {/* The two opening moves: both read-only, neither one interrupts anybody.
            The label goes below, because above is the panel's own title bar. */}
        <Highlight
          box={[3, 13, 94, 22]}
          delay={c2 + 10}
          color={COLORS.steel}
          label="read-only · runs without asking"
        />
      </Shot>

      <Body delay={c2 + 22} style={{ marginTop: 34, maxWidth: 1150 }}>
        Reaching the ops estate over MCP — thirteen tools, published with the annotations
        that decide which of them are allowed to run unattended.
      </Body>
    </SceneShell>
  );
};

export const Subagents = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const c4 = cue('Subagents', 'prod-04');

  const ROLES = [
    { name: 'performance-investigator', brief: 'characterise onset + magnitude' },
    { name: 'deployment-investigator', brief: 'enumerate changes in window' },
    { name: 'code-investigator', brief: 'read timing-plausible diffs' },
  ];

  return (
    <SceneShell intensity={0.66} padding={90}>
      <ActMark act="02" title="the run" />
      <Sfx name="whoosh" at={8} volume={0.26} />
      <SfxSeries name="tick" start={14} every={7} count={3} volume={0.16} />

      <Headline delay={0} style={{ fontSize: 62, marginBottom: 46 }}>
        Three lines of enquiry, in parallel.
      </Headline>

      {/* Root agent above, three subagents below, edges drawn as they spawn. */}
      <div style={{ position: 'relative', width: 1500, height: 400 }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <PipelineStep label="sentinel-agent" at={4} accent={COLORS.steel} wide />
        </div>

        <svg width={1500} height={400} style={{ position: 'absolute', inset: 0 }}>
          {ROLES.map((_, i) => {
            const at = 14 + i * 7;
            const s = ease(frame, at);
            const x2 = 250 + i * 500;
            return (
              <g key={i}>
                <path
                  d={`M750,72 C750,140 ${x2},130 ${x2},196`}
                  fill="none"
                  stroke={COLORS.lineStrong}
                  strokeWidth={1.4}
                  strokeDasharray={220}
                  strokeDashoffset={220 * (1 - s)}
                />
                {s > 0.98 ? (
                  <circle
                    cx={x2}
                    cy={196}
                    r={3.4}
                    fill={COLORS.steel}
                    opacity={0.5 + 0.5 * Math.sin((frame + i * 9) / 6)}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        <div
          style={{
            position: 'absolute',
            top: 210,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {ROLES.map((r, i) => {
            const at = 20 + i * 7;
            const s = ease(frame, at);
            return (
              <div
                key={r.name}
                style={{
                  width: 440,
                  padding: '26px 28px',
                  borderRadius: 12,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.surface,
                  opacity: s,
                  transform: `translateY(${(1 - s) * 18}px)`,
                }}
              >
                <div style={{ fontFamily: FONTS.mono, fontSize: 23, color: COLORS.ink }}>
                  {r.name}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 18,
                    color: COLORS.dim,
                    marginTop: 10,
                  }}
                >
                  {r.brief}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    fontFamily: FONTS.mono,
                    fontSize: 15,
                    letterSpacing: '0.2em',
                    color: COLORS.steel,
                    opacity: 0.72 + 0.28 * Math.sin((frame + i * 11) / 8),
                  }}
                >
                  RUNNING
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          display: 'flex',
          gap: 46,
          opacity: fade(frame, c4, c4 + 14),
        }}
      >
        {['isolated contexts', 'conclusions only', 'correlation never delegated'].map((t, i) => (
          <div
            key={t}
            style={{
              fontFamily: FONTS.mono,
              fontSize: 21,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: i === 2 ? COLORS.ink : COLORS.dim,
              opacity: fade(frame, c4 + i * 6, c4 + 12 + i * 6),
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

/** The refusal to hand the agent the answer — the load-bearing design choice. */
export const RawSamples = () => {
  const frame = useCurrentFrame();
  const c6 = cue('RawSamples', 'prod-06');

  const ROWS = [
    'ts,p95_latency_ms,p50_latency_ms,error_rate,rps',
    '2026-08-25T14:30:00Z,176.4,68.2,0.0041,120.8',
    '2026-08-25T14:31:00Z,179.1,67.5,0.0038,121.4',
    '2026-08-25T14:32:00Z,177.8,68.9,0.0040,120.1',
    '…',
    '2026-08-25T15:06:00Z,655.2,225.4,0.0618,121.9',
    '2026-08-25T15:07:00Z,661.7,224.1,0.0621,120.6',
  ];

  return (
    <SceneShell intensity={0.58} padding={90}>
      <ActMark act="02" title="the run" />
      <SfxSeries name="key" start={10} every={4} count={16} volume={0.1} />

      <Headline delay={0} style={{ fontSize: 58, marginBottom: 20 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 50, color: COLORS.steel }}>
          export_metrics_csv
        </span>
      </Headline>
      <Eyebrow delay={4} style={{ marginBottom: 40 }}>
        61 samples · raw · no analysis
      </Eyebrow>

      <div
        style={{
          width: 1280,
          padding: '28px 32px',
          borderRadius: 14,
          border: `1px solid ${COLORS.line}`,
          background: COLORS.surface,
          fontFamily: FONTS.mono,
          fontSize: 22,
          lineHeight: 1.72,
          color: COLORS.muted,
          whiteSpace: 'pre',
        }}
      >
        {ROWS.map((r, i) => (
          <div
            key={i}
            style={{
              color: i === 0 ? COLORS.dim : COLORS.ink,
              opacity: fade(frame, 8 + i * 4, 16 + i * 4),
            }}
          >
            {r}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 46, opacity: fade(frame, c6 - 4, c6 + 10) }}>
        <WordReveal
          text="The magnitude is never handed to the agent."
          delay={c6 - 4}
          size={54}
          color={COLORS.ink}
        />
      </div>
    </SceneShell>
  );
};

export const Sandbox = () => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.62} padding={90}>
      <ActMark act="02" title="the run" />
      <Sfx name="whoosh" at={4} volume={0.22} />

      <Eyebrow delay={0} style={{ marginBottom: 26 }}>
        sandbox · python 3.13 · holds no credentials
      </Eyebrow>

      <Shot
        name="sandbox"
        width={860}
        total={durationInFrames}
        delay={4}
        move={{ from: { scale: 1.0 }, to: { scale: 1.07 }, origin: [40, 40] }}
      />

      <Body delay={26} style={{ marginTop: 34, maxWidth: 1080 }}>
        Tool calls from sandbox code are bridged back to the harness, where the real keys live.
        Untrusted code cannot exfiltrate a key it never had.
      </Body>
    </SceneShell>
  );
};

/** The number landing. The single most important figure in the investigation. */
export const SandboxResult = () => {
  const frame = useCurrentFrame();
  const value = countTo(frame, 4, 3.7, 26);

  return (
    <SceneShell intensity={0.7} padding={90}>
      <ActMark act="02" title="the run" />
      <Sfx name="impact" at={26} volume={0.46} />

      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 26,
          color: COLORS.dim,
          marginBottom: 26,
          opacity: fade(frame, 0, 10),
        }}
      >
        stdout
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 30,
          color: COLORS.muted,
          opacity: fade(frame, 2, 12),
        }}
      >
        177.9 658.2 3.7000
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 28,
          marginTop: 34,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 210,
            fontWeight: 600,
            letterSpacing: '-0.045em',
            color: COLORS.ink,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 80px ${COLORS.steel}44`,
          }}
        >
          {value.toFixed(2)}×
        </span>
      </div>

      <div style={{ opacity: fade(frame, 28, 42) }}>
        <Eyebrow delay={28} color={COLORS.steel}>
          computed, not estimated
        </Eyebrow>
      </div>
    </SceneShell>
  );
};

export const Signals = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const c10 = cue('Signals', 'prod-10');

  return (
    <SceneShell intensity={0.58} padding={90}>
      <ActMark act="02" title="the run" />
      <Sfx name="tick" at={6} />
      <Sfx name="tick" at={16} />
      <Sfx name="impact" at={c10 + 4} volume={0.34} />

      <Eyebrow delay={0} style={{ marginBottom: 34 }}>
        the three golden signals, settled before vs settled after
      </Eyebrow>

      <Shot
        name="signals"
        width={1560}
        total={durationInFrames}
        delay={2}
        move={{ from: { scale: 1.0 }, to: { scale: 1.04 }, origin: [50, 70] }}
      >
        {/* The throughput row is the one that rules out a traffic surge. */}
        <Highlight
          box={[2, 71.5, 96, 27]}
          delay={c10 + 4}
          color={COLORS.ok}
          label="the row that rules out load"
        />
      </Shot>

      <Body delay={c10 + 16} style={{ marginTop: 30, maxWidth: 1200 }}>
        If traffic had surged, throughput would have moved with the latency. It did not.
      </Body>
    </SceneShell>
  );
};

export const Mechanism = () => {
  const frame = useCurrentFrame();
  const c12 = cue('Mechanism', 'prod-12');

  const DIFF = [
    { text: '  const taxProvider = createClient({', kind: 'ctx' },
    { text: '-   timeoutMs: 250,', kind: 'del' },
    { text: '-   retries: 0,', kind: 'del' },
    { text: '+   timeoutMs: 30_000,', kind: 'add' },
    { text: '+   retries: 3,', kind: 'add' },
    { text: '  });', kind: 'ctx' },
  ] as const;

  const colorFor = (k: string) =>
    k === 'add' ? COLORS.ok : k === 'del' ? COLORS.danger : COLORS.muted;

  return (
    <SceneShell intensity={0.64} padding={90}>
      <ActMark act="02" title="the run" />
      <SfxSeries name="tick" start={8} every={6} count={6} volume={0.14} />

      <Eyebrow delay={0} style={{ marginBottom: 26 }}>
        dpl-4c21 · the diff
      </Eyebrow>

      <div
        style={{
          width: 1180,
          padding: '30px 36px',
          borderRadius: 14,
          border: `1px solid ${COLORS.line}`,
          background: COLORS.surface,
          fontFamily: FONTS.mono,
          fontSize: 30,
          lineHeight: 1.74,
          whiteSpace: 'pre',
        }}
      >
        {DIFF.map((l, i) => (
          <div
            key={i}
            style={{
              color: colorFor(l.kind),
              background:
                l.kind === 'add'
                  ? `${COLORS.ok}12`
                  : l.kind === 'del'
                    ? `${COLORS.danger}12`
                    : 'transparent',
              opacity: fade(frame, 8 + i * 6, 18 + i * 6),
              margin: '0 -36px',
              padding: '0 36px',
            }}
          >
            {l.text}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          opacity: fade(frame, 52, 66),
        }}
      >
        <PipelineStep label="timeout 250ms → 30s" at={52} accent={COLORS.danger} />
        <PipelineArrow at={58} />
        <PipelineStep label="retries 0 → 3" at={60} accent={COLORS.danger} />
        <PipelineArrow at={66} />
        <PipelineStep label="p95 178 → 658ms" at={68} accent={COLORS.danger} active />
      </div>

      <div style={{ marginTop: 44, opacity: fade(frame, c12 - 4, c12 + 10) }}>
        <WordReveal
          text="Not a correlation. A mechanism."
          delay={c12 - 4}
          size={58}
          color={COLORS.ink}
        />
      </div>
    </SceneShell>
  );
};
