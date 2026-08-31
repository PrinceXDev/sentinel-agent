/**
 * The film.
 *
 * Scenes are laid out from `timing.json`, which is derived from the measured
 * length of every narrated line — so this file never contains a hand-written
 * duration. Add or rewrite a line, re-run `npm run vo`, and the cut moves with
 * it.
 *
 * Audio has three layers: the synthesised score underneath everything, the
 * narration on top of it, and effects placed inside individual scenes. The score
 * ducks under every spoken line so the voice always wins.
 */
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';
import { LINES, SCENES, TIMING } from '../lib/timeline';

import { ColdOpen, TitleCard } from '../scenes/act0-ColdOpen';
import { ProblemTabs, ProblemSplit, TwoFailures, Stakes } from '../scenes/act1-Problem';
import { InsightSplit, InsightPayoff } from '../scenes/act2-Insight';
import {
  RunTimeline,
  Subagents,
  RawSamples,
  Sandbox,
  SandboxResult,
  Signals,
  Mechanism,
} from '../scenes/act3-Product';
import { GateApproach, GateHold, GateCard, GateWait, CutAway } from '../scenes/act4-Gate';
import {
  ArchBuild,
  ArchFull,
  BugReveal,
  BugDiagram,
  BugPayoff,
  ThreeLayers,
} from '../scenes/act5-Architecture';
import {
  ProofOpen,
  Tests,
  GateProverIntro,
  GateProver,
  HonestVerdicts,
  InjectionIntro,
  InjectionNote,
  InjectionPayoff,
  Review,
  ResidualRisk,
} from '../scenes/act6-Proof';
import {
  BackToGate,
  Approve,
  Execute,
  Verify,
  Mitigated,
  RunComplete,
} from '../scenes/act7-Resolution';
import { Impact, FinaleBuild, FinaleLogo, Credits } from '../scenes/act8-Finale';

/** Every scene name in `timing.json` must resolve to a component here. */
const REGISTRY: Record<string, React.ComponentType> = {
  ColdOpen,
  TitleCard,
  ProblemTabs,
  ProblemSplit,
  TwoFailures,
  Stakes,
  InsightSplit,
  InsightPayoff,
  RunTimeline,
  Subagents,
  RawSamples,
  Sandbox,
  SandboxResult,
  Signals,
  Mechanism,
  GateApproach,
  GateHold,
  GateCard,
  GateWait,
  CutAway,
  ArchBuild,
  ArchFull,
  BugReveal,
  BugDiagram,
  BugPayoff,
  ThreeLayers,
  ProofOpen,
  Tests,
  GateProverIntro,
  GateProver,
  HonestVerdicts,
  InjectionIntro,
  InjectionNote,
  InjectionPayoff,
  Review,
  ResidualRisk,
  BackToGate,
  Approve,
  Execute,
  Verify,
  Mitigated,
  RunComplete,
  Impact,
  FinaleBuild,
  FinaleLogo,
  Credits,
};

/**
 * The score, ducked under speech.
 *
 * Remotion samples `volume` per frame, so the duck is computed from the same
 * line table the picture uses: full level in the gaps, well down under a voice.
 * The ramp is 10 frames either side, which is fast enough not to feel like a
 * fade and slow enough not to pump.
 */
const DUCK_RAMP = 10;
const BED_LEVEL = 0.3;
const DUCKED_LEVEL = 0.115;

const bedVolumeAt = (frame: number) => {
  let ducked = 0;
  for (const l of LINES) {
    const start = l.from;
    const end = l.from + Math.round(l.speech * TIMING.fps);
    if (frame < start - DUCK_RAMP || frame > end + DUCK_RAMP) continue;
    const rampIn = Math.min(1, Math.max(0, (frame - (start - DUCK_RAMP)) / DUCK_RAMP));
    const rampOut = Math.min(1, Math.max(0, (end + DUCK_RAMP - frame) / DUCK_RAMP));
    ducked = Math.max(ducked, Math.min(rampIn, rampOut));
  }
  return BED_LEVEL + (DUCKED_LEVEL - BED_LEVEL) * ducked;
};

const Score = () => (
  <Audio src={staticFile('audio/score.mp3')} volume={(f) => bedVolumeAt(f)} />
);

/** Narration. One clip per line, placed at the frame the timeline assigned it. */
const Narration = () => (
  <>
    {LINES.map((l) => (
      <Sequence
        key={l.id}
        from={l.from}
        durationInFrames={Math.ceil(l.speech * TIMING.fps) + 12}
        layout="none"
      >
        <Audio src={staticFile(`vo/${l.id}.mp3`)} volume={1} />
      </Sequence>
    ))}
  </>
);

/**
 * A 1-frame black cap at the very start and end.
 *
 * Players routinely show the first frame as a poster, and a half-drawn scene is
 * a poor one.
 */
const Bookends = () => {
  const frame = useCurrentFrame();
  const o = frame < 2 ? 1 : frame > TIMING.totalFrames - 3 ? 1 : 0;
  return <AbsoluteFill style={{ background: '#000', opacity: o }} />;
};

export const HackathonFilm = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.ground }}>
    {SCENES.map((s) => {
      const Component = REGISTRY[s.scene];
      if (!Component) throw new Error(`No component registered for scene "${s.scene}"`);
      return (
        <Sequence key={`${s.scene}-${s.from}`} from={s.from} durationInFrames={s.durationInFrames}>
          <Component />
        </Sequence>
      );
    })}
    <Bookends />
    <Score />
    <Narration />
  </AbsoluteFill>
);
