import { Config } from '@remotion/cli/config';

// 1080p, matching a screen recording shot at a normal desktop resolution —
// the intro/outro need to cut cleanly against footage of the real app, not
// look like a different aspect ratio spliced in.
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
