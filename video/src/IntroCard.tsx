import { loadFont as loadMono } from '@remotion/google-fonts/IBMPlexMono';
import { loadFont as loadSans } from '@remotion/google-fonts/IBMPlexSans';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { tokens } from './tokens';

const { fontFamily: sansFamily } = loadSans();
const { fontFamily: monoFamily } = loadMono();

/**
 * 5-second title card, matching the app's own palette and type — the video's
 * only job here is to feel like a continuation of the product, not a
 * separately-branded wrapper around it.
 *
 * One orchestrated sequence rather than several independent animations
 * firing at once: the eyebrow, then the name, then the tagline, each a beat
 * after the last. A single clear beat reads better at this length than
 * everything animating simultaneously.
 */
export function IntroCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowIn = spring({ frame, fps, config: { damping: 200 } });
  const nameIn = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const taglineIn = spring({ frame: frame - 18, fps, config: { damping: 200 } });

  // The live-status dot from TopBar.tsx's `breathe` animation, reproduced
  // exactly (2s ease-in-out cycle) so the intro already looks like the app
  // before any of it is on screen.
  const breathe = interpolate(
    frame % (fps * 2),
    [0, fps, fps * 2],
    [1, 0.35, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.ground,
        backgroundImage: `linear-gradient(${tokens.line}55 1px, transparent 1px), linear-gradient(90deg, ${tokens.line}55 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          opacity: eyebrowIn,
          transform: `translateY(${interpolate(eyebrowIn, [0, 1], [12, 0])}px)`,
          fontFamily: monoFamily,
          fontSize: 20,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: tokens.dim,
        }}
      >
        Agent Harness Hackathon · WeMakeDevs
      </div>

      <div
        style={{
          opacity: nameIn,
          transform: `translateY(${interpolate(nameIn, [0, 1], [16, 0])}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: tokens.steel,
            opacity: breathe,
          }}
        />
        <div
          style={{
            fontFamily: monoFamily,
            fontWeight: 500,
            fontSize: 88,
            letterSpacing: '-0.02em',
            color: tokens.ink,
          }}
        >
          sentinel-agent
        </div>
      </div>

      <div
        style={{
          opacity: taglineIn,
          transform: `translateY(${interpolate(taglineIn, [0, 1], [12, 0])}px)`,
          fontFamily: sansFamily,
          fontSize: 30,
          color: tokens.muted,
          maxWidth: 900,
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        Autonomous incident response, human-controlled execution
      </div>
    </AbsoluteFill>
  );
}
