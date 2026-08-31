/**
 * Real product footage, under a camera.
 *
 * Every `Shot` is a screenshot captured from the deployed sentinel-agent site by
 * `npm run capture`. Nothing in this film is a mock-up of the product — where a
 * panel appears, that is the panel, at 3× resolution so the camera can push a
 * long way into it before the pixels show.
 */
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';
import { camera, ease, fade, type CameraMove } from '../lib/anim';

type ShotProps = {
  /** Basename under `public/shots`, without the extension. */
  name: string;
  /** Rendered width in the 1920×1080 frame, before the camera move. */
  width: number;
  move?: CameraMove;
  /** Scene length in frames — the camera travels across all of it. */
  total: number;
  delay?: number;
  /** A chrome frame and drop shadow, as the product's own panels have. */
  framed?: boolean;
  /** Ring colour, when a shot should be visually claimed by an act. */
  accent?: string;
  /**
   * Overlays drawn *inside* the camera transform — `Highlight`, normally.
   *
   * They have to be in here rather than over the outer box: the camera scales
   * the image beneath them, so an overlay positioned on the container drifts off
   * whatever it is pointing at as soon as the camera starts moving.
   */
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export const Shot = ({
  name,
  width,
  move,
  total,
  delay = 0,
  framed = true,
  accent = COLORS.line,
  children,
  style,
}: ShotProps) => {
  const frame = useCurrentFrame();
  const s = ease(frame, delay);
  const cam = move ? camera(Math.max(0, frame - delay), total - delay, move) : {};

  return (
    <div
      style={{
        width,
        borderRadius: framed ? 16 : 0,
        overflow: 'hidden',
        border: framed ? `1px solid ${accent}` : 'none',
        boxShadow: framed ? `0 40px 110px -40px rgba(0,0,0,0.95)` : 'none',
        opacity: s,
        filter: `blur(${(1 - s) * 12}px)`,
        ...style,
      }}
    >
      <div style={{ ...cam, position: 'relative' }}>
        <Img
          src={staticFile(`shots/${name}.png`)}
          style={{ width: '100%', display: 'block' }}
        />
        {children}
      </div>
    </div>
  );
};

/**
 * A shot cropped to a region of itself, so the camera can hold on one detail.
 *
 * `focus` is the point of interest in percentages of the source image, and
 * `zoom` is how much of the image the crop shows — 2 means half of it.
 */
export const ShotCrop = ({
  name,
  width,
  height,
  focus,
  zoom,
  zoomTo,
  total,
  delay = 0,
  accent = COLORS.line,
  style,
}: {
  name: string;
  width: number;
  height: number;
  focus: [number, number];
  zoom: number;
  zoomTo?: number;
  total: number;
  delay?: number;
  accent?: string;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const s = ease(frame, delay);
  const z = zoomTo
    ? zoom + (zoomTo - zoom) * Math.min(1, Math.max(0, (frame - delay) / (total - delay))) ** 0.85
    : zoom;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${accent}`,
        boxShadow: '0 40px 110px -40px rgba(0,0,0,0.95)',
        position: 'relative',
        opacity: s,
        filter: `blur(${(1 - s) * 12}px)`,
        ...style,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile(`shots/${name}.png`)})`,
          backgroundSize: `${z * 100}%`,
          backgroundPosition: `${focus[0]}% ${focus[1]}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
};

/**
 * A rectangle drawn over a shot to call out one region of it.
 *
 * Coordinates are percentages of the shot's own box, so a highlight stays
 * attached to what it points at even if the shot is re-laid-out.
 */
export const Highlight = ({
  box,
  delay = 0,
  color = COLORS.steel,
  label,
}: {
  box: [number, number, number, number];
  delay?: number;
  color?: string;
  label?: string;
}) => {
  const frame = useCurrentFrame();
  const s = ease(frame, delay);
  const [x, y, w, h] = box;
  return (
    <>
      {/* Everything outside the callout is dimmed rather than the inside lit. */}
      <AbsoluteFill
        style={{
          background: 'rgba(6,9,12,0.62)',
          opacity: s * 0.88,
          clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                     ${x}% ${y}%, ${x}% ${y + h}%, ${x + w}% ${y + h}%, ${x + w}% ${y}%, ${x}% ${y}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: `${w}%`,
          height: `${h}%`,
          border: `2px solid ${color}`,
          borderRadius: 8,
          boxShadow: `0 0 34px ${color}55`,
          opacity: s,
          transform: `scale(${1.03 - s * 0.03})`,
        }}
      />
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: `${x}%`,
            // Above the box, unless that would leave the frame — then below it.
            top: y > 20 ? `calc(${y}% - 40px)` : `calc(${y + h}% + 14px)`,
            padding: '5px 12px',
            borderRadius: 6,
            background: COLORS.ground,
            border: `1px solid ${color}55`,
            fontFamily: 'IBMPlexMono, monospace',
            fontSize: 17,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            color,
            opacity: fade(frame, delay + 5, delay + 14),
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};
