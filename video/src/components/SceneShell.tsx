/**
 * The frame every scene renders into.
 *
 * It owns three things so no individual scene has to: the backdrop, the
 * cross-fade at each cut, and a consistent safe area. Scenes are therefore just
 * content, and the film's rhythm stays in one place.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop } from './Backdrop';
import { COLORS } from '../theme';
import { fadeInOut } from '../lib/anim';

export const SceneShell = ({
  children,
  intensity = 1,
  glow = COLORS.steel,
  /** Frames of cross-fade at each end. Longer where the film should breathe. */
  fadeFrames = 12,
  align = 'center',
  padding = 120,
  style,
}: {
  children: React.ReactNode;
  intensity?: number;
  glow?: string;
  fadeFrames?: number;
  align?: 'center' | 'flex-start';
  padding?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames, fadeFrames, fadeFrames);

  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop intensity={intensity} glow={glow}>
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: align,
            padding,
            ...style,
          }}
        >
          {children}
        </AbsoluteFill>
      </Backdrop>
    </AbsoluteFill>
  );
};

/**
 * The act label that sits in the top-left through the technical acts.
 *
 * A viewer who looks away for ten seconds needs to be able to re-orient without
 * rewinding, and this is cheaper than repeating the narration.
 */
export const ActMark = ({ act, title }: { act: string; title: string }) => {
  const frame = useCurrentFrame();
  const o = Math.min(1, frame / 14);
  return (
    <div
      style={{
        position: 'absolute',
        top: 66,
        left: 96,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity: o * 0.85,
        fontFamily: 'IBMPlexMono, monospace',
        fontSize: 17,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ color: COLORS.steel }}>{act}</span>
      <span style={{ width: 26, height: 1, background: COLORS.lineStrong }} />
      <span style={{ color: COLORS.dim }}>{title}</span>
    </div>
  );
};
