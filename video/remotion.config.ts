/**
 * Render settings for the sentinel-agent product film.
 *
 * The picture is mostly flat dark surfaces and fine monospaced type, which is
 * exactly the content H.264 smears first — so the CRF is well below Remotion's
 * default and the colour space is explicit.
 */
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setChromiumOpenGlRenderer('angle');
Config.setOverwriteOutput(true);
