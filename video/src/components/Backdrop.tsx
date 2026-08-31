/**
 * The ground every scene is built on.
 *
 * The product renders large empty panels over a faint 32px grid so they read as
 * an instrument surface rather than a void — the film inherits that, and adds
 * only what a still page cannot have: a slow parallax drift, and a vignette that
 * keeps the eye off the corners.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';
import { rand } from '../lib/anim';

type BackdropProps = {
  /** 0..1 — how present the grid and motes are. Quiet scenes use less. */
  intensity?: number;
  /** Colour of the faint bloom behind the content. */
  glow?: string;
  children?: React.ReactNode;
};

const MOTES = 46;

export const Backdrop = ({ intensity = 1, glow = COLORS.steel, children }: BackdropProps) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ground }}>
      {/* Grid, drifting slowly so the frame is never quite static. */}
      <AbsoluteFill
        style={{
          opacity: 0.5 * intensity,
          backgroundImage: `linear-gradient(to right, ${COLORS.line}66 1px, transparent 1px),
                            linear-gradient(to bottom, ${COLORS.line}66 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          transform: `translate(${(frame * 0.16) % 64}px, ${(frame * 0.09) % 64}px)`,
        }}
      />

      {/* A single soft bloom. Keeps the dark from going flat. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 700px at 50% 42%, ${glow}1f, transparent 68%)`,
          opacity: intensity,
        }}
      />

      {/* Motes. Deterministic, so every render is the same film. */}
      {Array.from({ length: MOTES }).map((_, i) => {
        const seed = i + 1;
        const x = rand(seed) * 1920;
        const drift = rand(seed * 3) * 60 - 30;
        const y = (rand(seed * 7) * 1200 + frame * (0.18 + rand(seed * 11) * 0.5)) % 1200 - 60;
        const size = 1 + rand(seed * 13) * 2.2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.sin((frame + seed * 40) / 90) * drift,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: COLORS.steel,
              opacity: (0.1 + rand(seed * 17) * 0.24) * intensity,
            }}
          />
        );
      })}

      {children}

      {/* Vignette, over everything. */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(1500px 900px at 50% 50%, transparent 42%, rgba(0,0,0,0.62) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
