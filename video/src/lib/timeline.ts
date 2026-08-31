/**
 * The cut list, derived from the narration.
 *
 * `timing.json` is written by `npm run vo` from the measured length of every
 * spoken line. Scenes read their length from here rather than declaring one, so
 * a scene physically cannot drift out of sync with the sentence it illustrates —
 * rewrite a line, re-run the voice, and the picture re-cuts itself.
 */
import timing from '../timing.json';

export type Line = {
  id: string;
  scene: string;
  text: string;
  /** Measured speech length, seconds, excluding tail and pad. */
  speech: number;
  pad: number;
  /** Absolute start frame in the film. */
  from: number;
  durationInFrames: number;
};

export type Scene = {
  scene: string;
  from: number;
  durationInFrames: number;
  lines: string[];
};

export const TIMING = timing as {
  fps: number;
  totalFrames: number;
  voice: string;
  lines: Line[];
  scenes: Scene[];
};

export const LINES: Line[] = TIMING.lines;
export const SCENES: Scene[] = TIMING.scenes;

const byId = new Map(LINES.map((l) => [l.id, l]));
const bySceneName = new Map(SCENES.map((s) => [s.scene, s]));

export const line = (id: string): Line => {
  const l = byId.get(id);
  if (!l) throw new Error(`No narration line "${id}" — check scripts/narration.mjs`);
  return l;
};

export const scene = (name: string): Scene => {
  const s = bySceneName.get(name);
  if (!s) throw new Error(`No scene "${name}" — check scripts/narration.mjs`);
  return s;
};

/**
 * A line's start frame relative to the scene that contains it.
 *
 * Scenes render inside their own `<Sequence>`, so every cue inside them is
 * expressed this way: "eight frames after the word 'stops'".
 */
export const cue = (sceneName: string, lineId: string): number =>
  line(lineId).from - scene(sceneName).from;

/** Where a line's spoken audio ends, relative to its scene. Cues land here. */
export const cueEnd = (sceneName: string, lineId: string): number => {
  const l = line(lineId);
  return cue(sceneName, lineId) + Math.round(l.speech * TIMING.fps);
};

export const TOTAL_FRAMES = TIMING.totalFrames;
