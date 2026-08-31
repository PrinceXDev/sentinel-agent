/**
 * Animation primitives.
 *
 * Every entrance, camera move and reveal in the film goes through one of these,
 * so motion reads as one system rather than fifty hand-tuned interpolations.
 * The springs are deliberately over-damped: this is a product film about a
 * system that refuses to be hasty, and bouncy motion would contradict it.
 */
import { interpolate, spring, Easing } from 'remotion';

export const FPS = 30;

/** The house spring. Firm, no overshoot. */
export const ease = (frame: number, delay = 0, damping = 200) =>
  spring({ frame: frame - delay, fps: FPS, config: { damping, mass: 0.9, stiffness: 110 } });

/** A softer one, for large objects that should feel heavy. */
export const easeSlow = (frame: number, delay = 0) =>
  spring({ frame: frame - delay, fps: FPS, config: { damping: 220, mass: 1.6, stiffness: 78 } });

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Linear-in-time fade with clamped ends. The workhorse. */
export const fade = (frame: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(frame, [from, to], [a, b], { ...clamp, easing: Easing.inOut(Easing.ease) });

/**
 * Fade a block in, hold it, and fade it out again.
 *
 * `out` is a frame count measured back from `total`, so a scene's contents can
 * be written without knowing the scene's length at the call site.
 */
export const fadeInOut = (frame: number, total: number, inFrames = 14, outFrames = 14) => {
  // A zero-length fade is a legitimate request (a hard cut), but interpolate
  // rejects a degenerate range — so it is answered here rather than guarded for
  // at every call site.
  const rise = inFrames <= 0 ? 1 : interpolate(frame, [0, inFrames], [0, 1], clamp);
  const fall =
    outFrames <= 0 ? 1 : interpolate(frame, [total - outFrames, total], [1, 0], clamp);
  return Math.min(rise, fall);
};

/** Rise-and-fade entrance. The default way anything appears. */
export const rise = (frame: number, delay = 0, distance = 34) => {
  const s = ease(frame, delay);
  return {
    opacity: s,
    transform: `translateY(${(1 - s) * distance}px)`,
  };
};

/** Entrance with defocus, for anything that should feel like it resolves. */
export const focusIn = (frame: number, delay = 0, blurPx = 14) => {
  const s = ease(frame, delay);
  return {
    opacity: s,
    filter: `blur(${(1 - s) * blurPx}px)`,
    transform: `scale(${0.97 + s * 0.03})`,
  };
};

/**
 * A simulated camera over a still.
 *
 * Shots are captured at 3× so a push can travel a long way before the pixels
 * show. `origin` is the point the camera holds on, in percentages of the image.
 */
export type CameraMove = {
  from: { scale: number; x?: number; y?: number };
  to: { scale: number; x?: number; y?: number };
  origin?: [number, number];
};

export const camera = (frame: number, total: number, move: CameraMove) => {
  // Eased across the whole shot: a camera never starts or stops abruptly.
  const t = interpolate(frame, [0, total], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.33, 0, 0.2, 1),
  });
  const scale = move.from.scale + (move.to.scale - move.from.scale) * t;
  const x = (move.from.x ?? 0) + ((move.to.x ?? 0) - (move.from.x ?? 0)) * t;
  const y = (move.from.y ?? 0) + ((move.to.y ?? 0) - (move.from.y ?? 0)) * t;
  const [ox, oy] = move.origin ?? [50, 50];
  return {
    transform: `scale(${scale}) translate(${x}px, ${y}px)`,
    transformOrigin: `${ox}% ${oy}%`,
  };
};

/** Characters revealed left to right. For a line that should feel typed. */
export const typed = (frame: number, text: string, startFrame: number, cps = 34) => {
  const shown = Math.floor(Math.max(0, frame - startFrame) * (cps / FPS));
  return text.slice(0, Math.min(text.length, shown));
};

/** Whether a caret should be lit this frame. */
export const caretOn = (frame: number) => frame % 26 < 15;

/** Counts a number up, for a figure that should land rather than appear. */
export const countTo = (frame: number, delay: number, target: number, frames = 26) => {
  const t = interpolate(frame, [delay, delay + frames], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return target * t;
};

/**
 * A clip-path wipe, in any of four directions.
 *
 * Used instead of a plain fade wherever one thing should feel like it *becomes*
 * another rather than dissolving into it.
 */
export const wipe = (progress: number, dir: 'up' | 'down' | 'left' | 'right' = 'up') => {
  const p = Math.max(0, Math.min(1, progress)) * 100;
  const inset = {
    up: `inset(${100 - p}% 0% 0% 0%)`,
    down: `inset(0% 0% ${100 - p}% 0%)`,
    left: `inset(0% ${100 - p}% 0% 0%)`,
    right: `inset(0% 0% 0% ${100 - p}%)`,
  } as const;
  return inset[dir];
};

/** Deterministic pseudo-random, so particles are identical on every render. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43_758.545_3;
  return x - Math.floor(x);
};
