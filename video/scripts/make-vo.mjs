/**
 * Renders the narration to audio and derives the film's timeline from it.
 *
 * Each line in `narration.mjs` becomes one MP3 plus a measured duration, and
 * those durations are written to `src/timing.json`. The Remotion composition
 * reads that file, so scene lengths follow the voice exactly — no scene can
 * drift out of sync with its line, because no scene has a hand-guessed length.
 *
 * Duration comes from edge-tts's own word-boundary stream (the end of the last
 * word), not from decoding the MP3, so it needs no ffprobe and is exact to the
 * synthesiser's own clock. A short tail is added because the boundary marks the
 * end of the final word, not the end of the file's decay.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NARRATION } from './narration.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const VO_DIR = path.join(ROOT, 'public', 'vo');
const PY = path.join(ROOT, '.venv', 'Scripts', 'python.exe');

const FPS = 30;
/** Warm, unhurried, documentary. Slowed slightly — the script is dense. */
const VOICE = 'en-US-AndrewMultilingualNeural';
const RATE = '+16%';
const PITCH = '-2Hz';

/** Tail after the final word boundary, so a line never clips its own decay. */
const TAIL_SECONDS = 0.22;

const helper = `
import asyncio, json, sys
import edge_tts

async def main():
    text, out, voice, rate, pitch = sys.argv[1:6]
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    last = 0
    with open(out, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                # Multilingual voices emit SentenceBoundary and no WordBoundary.
                last = max(last, chunk["offset"] + chunk["duration"])
    # edge-tts reports 100-nanosecond ticks.
    print(json.dumps({"seconds": last / 10_000_000}))

asyncio.run(main())
`;

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

const synthOnce = (line, outPath) =>
  new Promise((resolve, reject) => {
    const proc = spawn(
      PY,
      ['-c', helper, line.text, outPath, VOICE, RATE, PITCH],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => {
      out += d;
    });
    proc.stderr.on('data', (d) => {
      err += d;
    });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${line.id}: edge-tts exited ${code}\n${err}`));
      try {
        resolve(JSON.parse(out.trim()).seconds);
      } catch {
        reject(new Error(`${line.id}: could not read duration from "${out}"\n${err}`));
      }
    });
  });

/**
 * The endpoint drops a request now and then and answers the retry fine, so a
 * single failure must not abort a fifty-line render half way through.
 */
const synth = async (line, outPath) => {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await synthOnce(line, outPath);
    } catch (err) {
      lastErr = err;
      console.warn(`retry   ${line.id} (attempt ${attempt} failed)`);
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
  throw lastErr;
};

const run = async () => {
  if (!(await exists(PY))) {
    throw new Error(
      `No TTS environment at ${PY}.\n` +
        'Create it once with:\n' +
        '  python -m venv .venv && .venv/Scripts/python.exe -m pip install edge-tts',
    );
  }
  await mkdir(VO_DIR, { recursive: true });

  // A cached measurement is reused so re-running is cheap and, more importantly,
  // deterministic: a re-synthesised line would shift every cut after it.
  const cachePath = path.join(ROOT, 'src', 'timing.json');
  /** @type {Record<string, {seconds: number, text: string}>} */
  let cache = {};
  if (await exists(cachePath)) {
    const prev = JSON.parse(await readFile(cachePath, 'utf8'));
    for (const l of prev.lines ?? []) cache[l.id] = { seconds: l.speech, text: l.text };
  }

  const lines = [];
  let frame = 0;

  for (const line of NARRATION) {
    const file = path.join(VO_DIR, `${line.id}.mp3`);
    const cached = cache[line.id];
    const reusable = cached && cached.text === line.text && (await exists(file));

    const speech = reusable ? cached.seconds : await synth(line, file);
    if (!reusable) console.log(`voiced  ${line.id.padEnd(10)} ${speech.toFixed(2)}s`);

    const total = speech + TAIL_SECONDS + (line.pad ?? 0);
    const durationInFrames = Math.round(total * FPS);

    lines.push({
      id: line.id,
      scene: line.scene,
      text: line.text,
      speech,
      pad: line.pad ?? 0,
      from: frame,
      durationInFrames,
    });
    frame += durationInFrames;
  }

  // Scenes are contiguous runs of lines sharing a `scene` — the film's cut list.
  const scenes = [];
  for (const l of lines) {
    const last = scenes[scenes.length - 1];
    if (last && last.scene === l.scene) {
      last.durationInFrames += l.durationInFrames;
      last.lines.push(l.id);
    } else {
      scenes.push({
        scene: l.scene,
        from: l.from,
        durationInFrames: l.durationInFrames,
        lines: [l.id],
      });
    }
  }

  const timing = { fps: FPS, totalFrames: frame, voice: VOICE, lines, scenes };
  await writeFile(cachePath, `${JSON.stringify(timing, null, 2)}\n`);

  const secs = frame / FPS;
  console.log(
    `\n${lines.length} lines · ${scenes.length} scenes · ` +
      `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')} total`,
  );
  for (const s of scenes) {
    console.log(`  ${s.scene.padEnd(18)} ${(s.durationInFrames / FPS).toFixed(1)}s`);
  }
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
