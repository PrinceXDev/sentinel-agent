// Generate one WAV per narration segment via Piper TTS (local, no API key,
// no network dependency at generation time — the model was already
// downloaded). Run from inside WSL where the venv and model live.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();
const PIPER_PY = join(HOME, 'piper-venv', 'bin', 'python');
const MODEL = join(HOME, 'piper-voices', 'en_US-ryan-high.onnx');
const OUT_DIR = '/mnt/d/Training/Agent Harness/video/audio';

const segments = JSON.parse(
  readFileSync('/mnt/d/Training/Agent Harness/video/narration.json', 'utf8'),
);

mkdirSync(OUT_DIR, { recursive: true });

for (const seg of segments) {
  const outPath = join(OUT_DIR, `${seg.id}.wav`);
  console.log(`generating ${seg.id} -> ${outPath}`);
  execFileSync(
    PIPER_PY,
    ['-m', 'piper', '-m', MODEL, '-f', outPath],
    { input: seg.text, stdio: ['pipe', 'inherit', 'inherit'] },
  );
}

console.log('done');
