/**
 * Writes the narration out as an SRT, cued from the same measured timeline the
 * picture is cut to. Useful as a subtitle track and as a readable script with
 * real timecodes against it.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const stamp = (seconds) => {
  const ms = Math.round(seconds * 1000);
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  const f = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${f}`;
};

const timing = JSON.parse(await readFile(path.join(ROOT, 'src', 'timing.json'), 'utf8'));

const srt = timing.lines
  .map((l, i) => {
    const start = l.from / timing.fps;
    const end = start + l.speech;
    return `${i + 1}\n${stamp(start)} --> ${stamp(end)}\n${l.text}\n`;
  })
  .join('\n');

await writeFile(path.join(ROOT, 'out', 'sentinel-agent.srt'), srt);
console.log(`wrote out/sentinel-agent.srt — ${timing.lines.length} cues`);
