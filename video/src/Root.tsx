/**
 * Composition registry.
 *
 * The film's length is not declared here — it is read from `timing.json`, which
 * `npm run vo` writes from the measured length of every narrated line. That
 * keeps one source of truth for the cut: the script.
 */
import { Composition } from 'remotion';
import { loadFont as loadSans } from '@remotion/google-fonts/IBMPlexSans';
import { loadFont as loadMono } from '@remotion/google-fonts/IBMPlexMono';

import { HackathonFilm } from './compositions/HackathonFilm';
import { TOTAL_FRAMES, TIMING } from './lib/timeline';
import { VIDEO } from './theme';

// The product's own typefaces. Loaded at module scope so no frame renders in a
// fallback face — a swap mid-render would change every measured layout.
loadSans('normal', { weights: ['400', '500', '600'], subsets: ['latin'] });
loadMono('normal', { weights: ['400', '500'], subsets: ['latin'] });

export const RemotionRoot = () => (
  <>
    <Composition
      id="HackathonFilm"
      component={HackathonFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={TIMING.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  </>
);
