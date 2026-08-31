/**
 * Act VII — the approval, and the run completing.
 *
 * Every number, name and timestamp in this act comes from one real run against a
 * live TrueForge harness, recorded by `scripts/demo-run.mjs` and read back from
 * the estate's own audit log. The agent held six times; a human approved six
 * times; the estate recorded a rollback of `dpl-4c21` to `dpl-4c20`; and the
 * agent then re-read the metrics and reported the recovery it could measure.
 *
 * The verification figures — 657.7ms back to 177.6ms, 6.2% back to 0.37%, three
 * minutes — are quoted from the incident note the agent itself wrote at the end
 * of that run.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { SceneShell, ActMark } from '../components/SceneShell';
import { Eyebrow, Headline, Body, WordReveal } from '../components/Type';
import { Shot } from '../components/Shot';
import { Sfx, SfxSeries } from '../components/Sfx';
import { ease, fade, countTo, rand } from '../lib/anim';
import { cue } from '../lib/timeline';

/** Return to the held gate. The clock is still running. */
export const BackToGate = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell intensity={0.32} glow={COLORS.gate} fadeFrames={14}>
      <Sfx name="whoosh" at={0} volume={0.22} playbackRate={0.85} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          marginBottom: 44,
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
          still held
        </span>
      </div>

      <WordReveal text="Back to the gate." delay={4} size={78} color={COLORS.ink} />

      <div
        style={{
          marginTop: 46,
          fontFamily: FONTS.mono,
          fontSize: 30,
          color: COLORS.muted,
          opacity: fade(frame, 22, 36),
        }}
      >
        rollback_deployment(<span style={{ color: COLORS.gate }}>dpl-4c21</span>)
      </div>
    </SceneShell>
  );
};

/** The decision. A person reads the case and presses the button. */
export const Approve = () => {
  const frame = useCurrentFrame();
  const press = ease(frame, 20);
  const done = frame > 30;

  return (
    <SceneShell intensity={0.42} glow={COLORS.gate} fadeFrames={10}>
      <Sfx name="tick" at={20} volume={0.3} />
      <Sfx name="gate" at={22} volume={0.4} playbackRate={1.18} />

      <Eyebrow delay={0} color={COLORS.gate} style={{ marginBottom: 46 }}>
        a human reads the case
      </Eyebrow>

      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <div
          style={{
            padding: '26px 66px',
            borderRadius: 12,
            background: COLORS.gate,
            color: '#1a1206',
            fontFamily: FONTS.sans,
            fontSize: 44,
            fontWeight: 600,
            // A real press: down, then settle.
            transform: `scale(${1 - press * 0.045 + Math.max(0, press - 0.6) * 0.05})`,
            boxShadow: `0 0 ${20 + press * 60}px ${COLORS.gate}66`,
          }}
        >
          Approve
        </div>
        <div
          style={{
            padding: '26px 52px',
            borderRadius: 12,
            border: `1px solid ${COLORS.line}`,
            fontFamily: FONTS.sans,
            fontSize: 44,
            color: COLORS.dim,
            opacity: 1 - press * 0.55,
          }}
        >
          Deny
        </div>
      </div>

      <div
        style={{
          marginTop: 52,
          fontFamily: FONTS.mono,
          fontSize: 24,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: done ? COLORS.ok : COLORS.dim,
          opacity: fade(frame, 28, 40),
        }}
      >
        approval submitted as a new turn
      </div>
    </SceneShell>
  );
};

/** The call goes through, and the estate records it independently. */
export const Execute = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const c4 = cue('Execute', 'back-04');

  return (
    <SceneShell intensity={0.7} padding={80}>
      <ActMark act="06" title="execution" />
      <Sfx name="impact" at={4} volume={0.42} />
      <SfxSeries name="tick" start={c4} every={7} count={6} volume={0.14} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          marginBottom: 42,
          opacity: fade(frame, 2, 14),
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 34,
            color: COLORS.danger,
            textDecoration: 'line-through',
          }}
        >
          dpl-4c21
        </span>
        <span style={{ fontFamily: FONTS.mono, fontSize: 30, color: COLORS.dim }}>→</span>
        <span style={{ fontFamily: FONTS.mono, fontSize: 34, color: COLORS.ok }}>dpl-4c20</span>
        <span
          style={{
            marginLeft: 14,
            padding: '8px 16px',
            borderRadius: 999,
            border: `1px solid ${COLORS.ok}55`,
            background: `${COLORS.ok}12`,
            fontFamily: FONTS.mono,
            fontSize: 19,
            letterSpacing: '0.14em',
            color: COLORS.ok,
            opacity: fade(frame, 14, 26),
          }}
        >
          NOW LIVE
        </span>
      </div>

      {/* The estate's own record — not the agent's account of it. */}
      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <Shot
          name="con-audit"
          width={520}
          total={durationInFrames}
          delay={c4 - 6}
          move={{ from: { scale: 1.0 }, to: { scale: 1.06 }, origin: [50, 60] }}
        />
        <div style={{ width: 640, paddingTop: 30 }}>
          <Eyebrow delay={c4} color={COLORS.steel}>
            the estate's own audit log
          </Eyebrow>
          <div style={{ marginTop: 24, opacity: fade(frame, c4 + 8, c4 + 22) }}>
            <Body delay={c4 + 8} align="left" style={{ fontSize: 27 }}>
              A record independent of the agent's account of what it did. The agent says it rolled
              back <span style={{ fontFamily: FONTS.mono, color: COLORS.ink }}>dpl-4c21</span>;
              the estate says a rollback of{' '}
              <span style={{ fontFamily: FONTS.mono, color: COLORS.ink }}>dpl-4c21</span> was
              recorded.
            </Body>
          </div>
          <div style={{ marginTop: 28, opacity: fade(frame, c4 + 22, c4 + 36) }}>
            <Body delay={c4 + 22} align="left" style={{ fontSize: 25, color: COLORS.dim }}>
              Two sources that can be compared are worth more than one that has to be trusted.
            </Body>
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

/**
 * Verification.
 *
 * Rule seven of the agent's own instructions: after a remediation is approved
 * and executed, re-read the metrics and report what recovered. These are the
 * figures from that report.
 */
export const Verify = () => {
  const frame = useCurrentFrame();
  const c6 = cue('Verify', 'back-06');

  const W = 1360;
  const H = 300;
  const N = 46;
  const draw = Math.min(1, Math.max(0, (frame - 8) / 46));

  // Flat at the plateau, then the four-minute ease back to baseline.
  const y = (i: number) => {
    const t = i / (N - 1);
    if (t < 0.34) return 657.7 + (rand(i) - 0.5) * 9;
    const k = Math.min(1, (t - 0.34) / 0.26);
    const eased = 1 - (1 - k) ** 2;
    return 657.7 + (177.6 - 657.7) * eased + (rand(i * 3) - 0.5) * 7;
  };

  const pts = Array.from({ length: N }, (_, i) => {
    const px = (i / (N - 1)) * W;
    const py = H - (y(i) / 760) * H;
    return [px, py] as const;
  });
  const shown = Math.max(2, Math.floor(pts.length * draw));
  const toPath = (slice: readonly (readonly [number, number])[]) =>
    slice
      .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`)
      .join(' ');

  // Split at the point the series crosses back under the 400ms budget, so the
  // line is red while the incident is still live and green only once it is not.
  const crossing = pts.findIndex(([, py]) => py > H - (400 / 760) * H);
  const split = crossing === -1 ? shown : Math.min(shown, crossing + 1);
  const beforePath = toPath(pts.slice(0, split));
  const afterPath = shown > split ? toPath(pts.slice(split - 1, shown)) : '';
  const recovered = shown > split;

  return (
    <SceneShell intensity={0.58} padding={80}>
      <ActMark act="06" title="verify" />
      <Sfx name="whoosh" at={8} volume={0.2} />
      <Sfx name="impact" at={c6 + 2} volume={0.36} />

      <Eyebrow delay={0} style={{ marginBottom: 24 }}>
        re-read the metrics · confirm the symptom is recovering
      </Eyebrow>

      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <line
          x1={0}
          y1={H - (400 / 760) * H}
          x2={W}
          y2={H - (400 / 760) * H}
          stroke={COLORS.danger}
          strokeWidth={1.4}
          strokeDasharray="7 7"
          opacity={0.45}
        />
        <line
          x1={0}
          y1={H - (177.8 / 760) * H}
          x2={W}
          y2={H - (177.8 / 760) * H}
          stroke={COLORS.ok}
          strokeWidth={1.2}
          strokeDasharray="4 8"
          opacity={0.45}
        />
        <text
          x={W}
          y={H - (177.8 / 760) * H - 10}
          textAnchor="end"
          fontFamily={FONTS.mono}
          fontSize={17}
          fill={COLORS.ok}
          opacity={0.8}
        >
          baseline 177.8ms
        </text>
        <path
          d={beforePath}
          fill="none"
          stroke={COLORS.danger}
          strokeWidth={3}
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 16px ${COLORS.danger}77)` }}
        />
        {afterPath ? (
          <path
            d={afterPath}
            fill="none"
            stroke={COLORS.ok}
            strokeWidth={3}
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 16px ${COLORS.ok}88)` }}
          />
        ) : null}
      </svg>

      <div
        style={{
          marginTop: 46,
          display: 'flex',
          gap: 78,
          opacity: fade(frame, c6 - 6, c6 + 8),
        }}
      >
        {[
          { k: 'p95 latency', from: '657.7 ms', to: '177.6 ms' },
          { k: 'error rate', from: '6.2 %', to: '0.37 %' },
          { k: 'recovery', from: '', to: '3 minutes' },
        ].map((s, i) => (
          <div
            key={s.k}
            style={{ textAlign: 'center', opacity: fade(frame, c6 - 6 + i * 6, c6 + 8 + i * 6) }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, justifyContent: 'center' }}>
              {s.from ? (
                <>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 27,
                      color: COLORS.dim,
                      textDecoration: 'line-through',
                    }}
                  >
                    {s.from}
                  </span>
                  <span style={{ color: COLORS.dim, fontSize: 22 }}>→</span>
                </>
              ) : null}
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 54,
                  fontWeight: 600,
                  color: COLORS.ok,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.to}
              </span>
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: FONTS.mono,
                fontSize: 18,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: COLORS.dim,
              }}
            >
              {s.k}
            </div>
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

/** The estate agrees: mitigated, healthy, and the rolled-back-to build live. */
export const Mitigated = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <SceneShell intensity={0.6} padding={80}>
      <ActMark act="06" title="mitigated" />
      <Sfx name="impact" at={4} volume={0.38} />

      <Shot
        name="con-incident"
        width={1560}
        total={durationInFrames}
        delay={2}
        accent={`${COLORS.ok}33`}
        move={{ from: { scale: 1.0 }, to: { scale: 1.045 }, origin: [50, 26] }}
      />

      <div
        style={{
          marginTop: 44,
          display: 'flex',
          gap: 22,
          opacity: fade(frame, 22, 36),
        }}
      >
        {[
          'status mitigated',
          'health healthy · 8/8 ready',
          'live deployment dpl-4c20',
        ].map((t, i) => (
          <div
            key={t}
            style={{
              padding: '16px 28px',
              borderRadius: 999,
              border: `1px solid ${COLORS.ok}44`,
              background: `${COLORS.ok}0d`,
              fontFamily: FONTS.mono,
              fontSize: 22,
              color: COLORS.ok,
              opacity: fade(frame, 22 + i * 6, 36 + i * 6),
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

/** The run, complete. Everything it did, counted. */
export const RunComplete = () => {
  const frame = useCurrentFrame();

  const STATS = [
    { v: 13, label: 'MCP tools available', c: COLORS.steel },
    { v: 6, label: 'subagent threads', c: COLORS.steel },
    { v: 6, label: 'gated calls held', c: COLORS.gate },
    { v: 6, label: 'approved by a human', c: COLORS.gate },
    { v: 10, label: 'evidence claims, each sourced', c: COLORS.ok },
  ];

  return (
    <SceneShell intensity={0.72} padding={80}>
      <Sfx name="gate" at={4} volume={0.4} />
      <SfxSeries name="tick" start={10} every={6} count={5} volume={0.16} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 56,
          opacity: fade(frame, 0, 14),
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: COLORS.ok,
            boxShadow: `0 0 24px ${COLORS.ok}`,
          }}
        />
        <Headline delay={0} style={{ fontSize: 78 }}>
          Run complete.
        </Headline>
      </div>

      <div style={{ display: 'flex', gap: 54 }}>
        {STATS.map((s, i) => {
          const at = 10 + i * 6;
          return (
            <div
              key={s.label}
              style={{ width: 280, textAlign: 'center', opacity: fade(frame, at, at + 14) }}
            >
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 96,
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  color: s.c,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round(countTo(frame, at, s.v, 22))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontFamily: FONTS.sans,
                  fontSize: 22,
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

      <div
        style={{
          marginTop: 60,
          fontFamily: FONTS.mono,
          fontSize: 21,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: COLORS.dim,
          opacity: fade(frame, 46, 62),
        }}
      >
        one live run · openrouter/claude-sonnet-4-5 · local sandbox · no daytona key
      </div>
    </SceneShell>
  );
};
