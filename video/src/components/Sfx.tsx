/**
 * Sound placement.
 *
 * All of these are synthesised by `npm run score` — no licensed material. The
 * mix rule is that the voice always wins: the bed sits far under it, and effects
 * are used to *punctuate* a cut, never to decorate one. A film that clicks at
 * every animation becomes exhausting within a minute.
 */
import { Audio, Sequence, staticFile } from 'remotion';

export type SfxName = 'impact' | 'whoosh' | 'riser' | 'tick' | 'gate' | 'key' | 'alert';

/** Per-effect levels, set once so a cue site never has to guess. */
const LEVEL: Record<SfxName, number> = {
  impact: 0.5,
  whoosh: 0.32,
  riser: 0.34,
  tick: 0.2,
  gate: 0.46,
  key: 0.14,
  alert: 0.3,
};

export const Sfx = ({
  name,
  at,
  volume,
  playbackRate = 1,
}: {
  name: SfxName;
  /** Frame within the enclosing sequence. */
  at: number;
  volume?: number;
  playbackRate?: number;
}) => (
  <Sequence from={at} durationInFrames={200} layout="none">
    <Audio
      src={staticFile(`audio/${name}.mp3`)}
      volume={volume ?? LEVEL[name]}
      playbackRate={playbackRate}
    />
  </Sequence>
);

/** Several of the same effect, evenly spaced. For a list populating. */
export const SfxSeries = ({
  name,
  start,
  every,
  count,
  volume,
}: {
  name: SfxName;
  start: number;
  every: number;
  count: number;
  volume?: number;
}) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <Sfx key={i} name={name} at={start + i * every} volume={volume} />
    ))}
  </>
);
