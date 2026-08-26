import { Composition } from 'remotion';

import { IntroCard } from './IntroCard';
import { OutroCard } from './OutroCard';

const FPS = 30;

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Intro"
        component={IntroCard}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Outro"
        component={OutroCard}
        durationInFrames={7 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
}
