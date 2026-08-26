import { loadFont as loadMono } from '@remotion/google-fonts/IBMPlexMono';
import { loadFont as loadSans } from '@remotion/google-fonts/IBMPlexSans';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { tokens } from './tokens';

const { fontFamily: sansFamily } = loadSans();
const { fontFamily: monoFamily } = loadMono();

const CAPABILITIES = ['real tools', 'sandboxed code', 'subagents', 'human approval'];

/**
 * ~7-second closing card.
 *
 * The four-word tagline is not a new line written for the video — it is the
 * exact copy from Timeline.tsx's empty state, the same words a judge would
 * see if they opened the app themselves before running anything. Reusing it
 * here rather than writing fresh marketing copy keeps the video honest about
 * being the same claim made twice, not a bigger promise than the product
 * itself makes.
 */
export function OutroCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tagIn = spring({ frame, fps, config: { damping: 200 } });
  const linkIn = spring({ frame: frame - 15, fps, config: { damping: 200 } });
  const creditIn = spring({ frame: frame - 25, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.ground,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
      }}
    >
      <div
        style={{
          opacity: tagIn,
          display: 'flex',
          gap: 28,
          fontFamily: monoFamily,
          fontSize: 24,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {CAPABILITIES.map((word, i) => (
          <span key={word} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <span style={{ color: tokens.ink }}>{word}</span>
            {i < CAPABILITIES.length - 1 && <span style={{ color: tokens.steelDim }}>·</span>}
          </span>
        ))}
      </div>

      <div
        style={{
          opacity: linkIn,
          transform: `translateY(${interpolate(linkIn, [0, 1], [10, 0])}px)`,
          fontFamily: sansFamily,
          fontSize: 34,
          color: tokens.steel,
        }}
      >
        github.com/PrinceXDev/sentinel-agent
      </div>

      <div
        style={{
          opacity: creditIn,
          fontFamily: monoFamily,
          fontSize: 18,
          letterSpacing: '0.08em',
          color: tokens.dim,
        }}
      >
        BUILT ON TRUEFORGE · REVIEWED WITH QODO
      </div>
    </AbsoluteFill>
  );
}
