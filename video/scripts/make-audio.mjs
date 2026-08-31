/**
 * Synthesises the film's score and sound-effect kit.
 *
 * Everything here is generated from code — no sampled or licensed material — so
 * the audio is deterministic, redistributable with the repository, and exactly
 * as long as the picture. The score reads `src/timing.json` and shapes itself
 * around the actual cut: the drone thickens where the act does, the pulse enters
 * with the product, and the whole bed steps out of the way under narration.
 *
 * The bed is deliberately harmonic and slow. Anything melodic under a dense
 * technical voiceover competes with it, and the voice has to win.
 *
 * Run: npm run score
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'public', 'audio');

const SR = 48_000;
const TAU = Math.PI * 2;

// ── WAV ────────────────────────────────────────────────────────────────────

/** 16-bit stereo PCM. */
const encodeWav = (left, right) => {
  const frames = left.length;
  const dataBytes = frames * 4;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  for (let i = 0; i < frames; i += 1) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE(Math.round(l * 32_767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32_767), 46 + i * 4);
  }
  return buf;
};

// ── helpers ────────────────────────────────────────────────────────────────

/** Deterministic noise. Math.random would make every render a different film. */
const makeRng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4_294_967_296;
  };
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * clamp01(t);
/** Equal-power-ish smoothstep; used for every fade so nothing clicks. */
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** One-pole lowpass, run in place. */
const lowpass = (buf, cutoffHz) => {
  const a = 1 - Math.exp((-TAU * cutoffHz) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i += 1) {
    y += a * (buf[i] - y);
    buf[i] = y;
  }
};

/** One-pole highpass, run in place. Keeps the sub out of the effects. */
const highpass = (buf, cutoffHz) => {
  const a = 1 - Math.exp((-TAU * cutoffHz) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i += 1) {
    y += a * (buf[i] - y);
    buf[i] -= y;
  }
};

/**
 * Schroeder-ish reverb: four combs into two allpasses. Cheap, and enough to put
 * the pad in a room rather than against the listener's ear.
 */
const reverb = (buf, mix, decay) => {
  const combs = [1687, 1601, 2053, 2251];
  const allpass = [556, 441];
  const wet = new Float64Array(buf.length);

  for (const len of combs) {
    const line = new Float64Array(len);
    let idx = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const out = line[idx];
      wet[i] += out * 0.25;
      line[idx] = buf[i] + out * decay;
      idx = (idx + 1) % len;
    }
  }
  for (const len of allpass) {
    const line = new Float64Array(len);
    let idx = 0;
    for (let i = 0; i < wet.length; i += 1) {
      const bufd = line[idx];
      const out = -wet[i] + bufd;
      line[idx] = wet[i] + bufd * 0.5;
      wet[i] = out;
      idx = (idx + 1) % len;
    }
  }
  for (let i = 0; i < buf.length; i += 1) buf[i] = buf[i] * (1 - mix) + wet[i] * mix;
};

// ── the score ──────────────────────────────────────────────────────────────

/**
 * Intensity per act, 0..1. This is the emotional shape of the film, written
 * down as numbers: tension, a drop into the insight, a lift through the
 * product, controlled rhythm under the architecture, a build through the proof,
 * and a resolution.
 */
const INTENSITY = {
  ColdOpen: 0.62,
  TitleCard: 0.30,
  ProblemTabs: 0.46,
  ProblemSplit: 0.40,
  TwoFailures: 0.55,
  Stakes: 0.72,
  InsightSplit: 0.24,
  InsightPayoff: 0.44,
  RunTimeline: 0.56,
  Subagents: 0.66,
  RawSamples: 0.54,
  Sandbox: 0.62,
  SandboxResult: 0.70,
  Signals: 0.58,
  Mechanism: 0.64,
  GateApproach: 0.50,
  GateHold: 0.16,
  GateCard: 0.34,
  // The hold. Almost nothing plays here — the silence is the point.
  GateWait: 0.13,
  CutAway: 0.40,
  ArchBuild: 0.50,
  ArchFull: 0.60,
  BugReveal: 0.56,
  BugDiagram: 0.60,
  BugPayoff: 0.74,
  ThreeLayers: 0.58,
  ProofOpen: 0.44,
  Tests: 0.62,
  GateProverIntro: 0.56,
  GateProver: 0.68,
  HonestVerdicts: 0.60,
  InjectionIntro: 0.58,
  InjectionNote: 0.70,
  InjectionPayoff: 0.64,
  Review: 0.58,
  ResidualRisk: 0.48,
  BackToGate: 0.34,
  Approve: 0.54,
  Execute: 0.72,
  Verify: 0.58,
  Mitigated: 0.66,
  RunComplete: 0.74,
  Impact: 0.60,
  FinaleBuild: 0.72,
  FinaleLogo: 0.80,
  Credits: 0.34,
};

/** Whether the pulse layer runs — the bed is still where the film is still. */
const NO_PULSE = new Set([
  'TitleCard',
  'InsightSplit',
  'GateHold',
  'GateCard',
  'GateWait',
  'BackToGate',
  'Credits',
  'ProofOpen',
  'FinaleLogo',
]);

/** A minor, modal. Root frequencies and the chord tones over them. */
const PROGRESSION = [
  { root: 55.0, tones: [220.0, 261.63, 329.63] }, // Am
  { root: 43.65, tones: [174.61, 220.0, 261.63] }, // Fmaj7-ish
  { root: 36.71, tones: [196.0, 246.94, 293.66] }, // G
  { root: 48.99, tones: [196.0, 233.08, 293.66] }, // Dm
];
const BAR_SECONDS = 8;

const buildScore = (timing) => {
  const totalSeconds = timing.totalFrames / timing.fps + 1.0;
  const n = Math.ceil(totalSeconds * SR);
  const rng = makeRng(0x5e11e1);

  const sub = new Float64Array(n);
  const pad = new Float64Array(n);
  const pulse = new Float64Array(n);
  const air = new Float64Array(n);

  /** Intensity sampled per frame, then smoothed so it never steps. */
  const inten = new Float64Array(n);
  {
    const raw = new Float64Array(n);
    for (const sc of timing.scenes) {
      const a = Math.floor((sc.from / timing.fps) * SR);
      const b = Math.min(n, Math.floor(((sc.from + sc.durationInFrames) / timing.fps) * SR));
      const v = INTENSITY[sc.scene] ?? 0.5;
      for (let i = a; i < b; i += 1) raw[i] = v;
    }
    for (let i = 0; i < n; i += 1) if (raw[i] === 0) raw[i] = 0.5;
    // ~2.5s one-pole slew in each direction, so an act change is a swell.
    const a = 1 - Math.exp(-1 / (2.5 * SR));
    let y = raw[0];
    for (let i = 0; i < n; i += 1) {
      y += a * (raw[i] - y);
      inten[i] = y;
    }
    let z = inten[n - 1];
    for (let i = n - 1; i >= 0; i -= 1) {
      z += a * (inten[i] - z);
      inten[i] = (inten[i] + z) * 0.5;
    }
  }

  /** Which scene a sample belongs to — used for the pulse gate. */
  const pulseGate = new Float64Array(n);
  {
    const raw = new Float64Array(n);
    for (const sc of timing.scenes) {
      const a = Math.floor((sc.from / timing.fps) * SR);
      const b = Math.min(n, Math.floor(((sc.from + sc.durationInFrames) / timing.fps) * SR));
      const on = NO_PULSE.has(sc.scene) ? 0 : 1;
      for (let i = a; i < b; i += 1) raw[i] = on;
    }
    const a = 1 - Math.exp(-1 / (1.2 * SR));
    let y = 0;
    for (let i = 0; i < n; i += 1) {
      y += a * (raw[i] - y);
      pulseGate[i] = y;
    }
  }

  // Sub + pad, chord by chord.
  let phaseSub = 0;
  const padPhases = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const chord = PROGRESSION[Math.floor(t / BAR_SECONDS) % PROGRESSION.length];
    const inBar = (t % BAR_SECONDS) / BAR_SECONDS;
    // Crossfade the last 12% of the bar so chords glide rather than switch.
    const swell = 0.72 + 0.28 * Math.sin(TAU * (inBar - 0.25));
    const k = inten[i];

    phaseSub += (TAU * chord.root) / SR;
    sub[i] = Math.sin(phaseSub) * 0.5 * (0.35 + k * 0.65) * swell;

    // Three tones, each doubled with a slight detune for width.
    let acc = 0;
    for (let v = 0; v < 3; v += 1) {
      const f = chord.tones[v];
      padPhases[v] += (TAU * f) / SR;
      padPhases[v + 3] += (TAU * f * 1.0037) / SR;
      // Soft saw: a few harmonics, so the lowpass has something to eat.
      const s1 = Math.sin(padPhases[v]) + 0.34 * Math.sin(padPhases[v] * 2);
      const s2 = Math.sin(padPhases[v + 3]) + 0.34 * Math.sin(padPhases[v + 3] * 2);
      acc += (s1 + s2) * (v === 0 ? 0.5 : 0.34);
    }
    pad[i] = acc * 0.13 * (0.3 + k * 0.7) * swell;

    air[i] = (rng() * 2 - 1) * 0.02 * (0.2 + k * 0.8);
  }

  lowpass(pad, 900);
  reverb(pad, 0.42, 0.72);
  highpass(air, 4000);
  lowpass(sub, 140);

  // Pulse: a soft filtered blip on the half-beat at 84bpm.
  {
    const beat = 60 / 84 / 2;
    const step = Math.floor(beat * SR);
    const len = Math.floor(0.16 * SR);
    for (let start = 0, idx = 0; start < n; start += step, idx += 1) {
      const k = inten[Math.min(n - 1, start)];
      const gate = pulseGate[Math.min(n - 1, start)];
      if (gate < 0.02) continue;
      // Accent the downbeat; the offbeats sit well under it.
      const accent = idx % 4 === 0 ? 1 : idx % 2 === 0 ? 0.5 : 0.28;
      const amp = 0.055 * accent * gate * (0.25 + k * 0.75);
      const f = idx % 4 === 0 ? 110 : 220;
      for (let j = 0; j < len && start + j < n; j += 1) {
        const env = Math.exp(-j / (SR * 0.035));
        pulse[start + j] += Math.sin((TAU * f * j) / SR) * env * amp;
      }
    }
    lowpass(pulse, 2400);
    reverb(pulse, 0.2, 0.6);
  }

  // Mix, with a gentle stereo spread on the pad and air only.
  const left = new Float64Array(n);
  const right = new Float64Array(n);
  const delay = Math.floor(0.011 * SR);
  for (let i = 0; i < n; i += 1) {
    const mono = sub[i] * 0.9 + pulse[i];
    const wide = pad[i] + air[i];
    const wideD = i >= delay ? pad[i - delay] + air[i - delay] : 0;
    left[i] = mono + wide * 0.62 + wideD * 0.38;
    right[i] = mono + wideD * 0.62 + wide * 0.38;
  }

  // Fade in and out, and soft-clip so nothing ever hits the ceiling hard.
  const fadeIn = Math.floor(2.2 * SR);
  const fadeOut = Math.floor(4.0 * SR);
  for (let i = 0; i < n; i += 1) {
    let g = 1;
    if (i < fadeIn) g *= smooth(i / fadeIn);
    if (i > n - fadeOut) g *= smooth((n - i) / fadeOut);
    left[i] = Math.tanh(left[i] * g * 1.15) * 0.72;
    right[i] = Math.tanh(right[i] * g * 1.15) * 0.72;
  }

  return { left, right, seconds: n / SR };
};

// ── the effects kit ────────────────────────────────────────────────────────

const mono = (seconds, fn) => {
  const n = Math.floor(seconds * SR);
  const b = new Float64Array(n);
  for (let i = 0; i < n; i += 1) b[i] = fn(i / SR, i, n);
  return b;
};

const EFFECTS = {
  /** Act-boundary hit: a sub drop with a short bright transient on top. */
  impact: () => {
    const rng = makeRng(11);
    const b = mono(2.4, (t) => {
      const sweep = 120 * Math.exp(-t * 6) + 38;
      const body = Math.sin(TAU * sweep * t) * Math.exp(-t * 2.1);
      const crack = (rng() * 2 - 1) * Math.exp(-t * 34) * 0.55;
      return body * 0.85 + crack;
    });
    reverb(b, 0.28, 0.7);
    return b;
  },

  /** Transition sweep. Noise through a rising then falling band. */
  whoosh: () => {
    const rng = makeRng(23);
    const n = Math.floor(1.1 * SR);
    const b = new Float64Array(n);
    let y = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const cut = 300 + 5200 * Math.sin(Math.PI * t) ** 1.6;
      const a = 1 - Math.exp((-TAU * cut) / SR);
      y += a * ((rng() * 2 - 1) - y);
      b[i] = y * Math.sin(Math.PI * t) ** 1.4 * 0.5;
    }
    reverb(b, 0.24, 0.6);
    return b;
  },

  /** Rising tension bed, laid under a reveal. */
  riser: () => {
    const rng = makeRng(37);
    const n = Math.floor(2.6 * SR);
    const b = new Float64Array(n);
    let y = 0;
    let ph = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const cut = 260 + 4200 * t ** 2.2;
      const a = 1 - Math.exp((-TAU * cut) / SR);
      y += a * ((rng() * 2 - 1) - y);
      ph += (TAU * (110 + 330 * t ** 2)) / SR;
      b[i] = (y * 0.6 + Math.sin(ph) * 0.22) * t ** 1.5 * 0.55;
    }
    reverb(b, 0.3, 0.72);
    return b;
  },

  /** One row of a timeline appearing. Must be tiny — it fires often. */
  tick: () =>
    mono(0.13, (t) => {
      const env = Math.exp(-t * 46);
      return (Math.sin(TAU * 1180 * t) * 0.6 + Math.sin(TAU * 2360 * t) * 0.25) * env * 0.4;
    }),

  /** The gate. The one warm, held, unmistakable sound in the film. */
  gate: () => {
    const b = mono(3.2, (t) => {
      const env = Math.min(1, t * 26) * Math.exp(-t * 1.15);
      // A fifth, then the octave above — settled, not alarming.
      return (
        (Math.sin(TAU * 293.66 * t) * 0.5 +
          Math.sin(TAU * 440.0 * t) * 0.32 +
          Math.sin(TAU * 587.33 * t) * 0.18) *
        env *
        0.5
      );
    });
    reverb(b, 0.45, 0.8);
    return b;
  },

  /** A single soft key press, for the terminal typing. */
  key: () => {
    const rng = makeRng(59);
    return mono(0.06, (t) => (rng() * 2 - 1) * Math.exp(-t * 150) * 0.3);
  },

  /** Alarm blip for the cold open. Urgent, but not a klaxon. */
  alert: () => {
    const b = mono(0.9, (t) => {
      const env = Math.exp(-t * 4.2) * Math.min(1, t * 60);
      const warble = Math.sin(TAU * 7 * t) * 24;
      return Math.sin(TAU * (660 + warble) * t) * env * 0.34;
    });
    reverb(b, 0.22, 0.6);
    return b;
  },
};

// ── main ───────────────────────────────────────────────────────────────────

/**
 * Compress to MP3 via the ffmpeg Remotion already ships.
 *
 * A seven-minute stereo WAV score is ~64MB, and the renderer fetches every asset
 * over HTTP per worker. That is enough IO pressure to produce a truncated copy,
 * which then fails ffprobe mid-render with "Invalid data found" — so the WAVs are
 * intermediates and only MP3s are kept.
 */
const FFMPEG = path.join(
  ROOT,
  'node_modules',
  '@remotion',
  process.platform === 'win32'
    ? 'compositor-win32-x64-msvc'
    : process.platform === 'darwin'
      ? 'compositor-darwin-arm64'
      : 'compositor-linux-x64-gnu',
  process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
);

const toMp3 = async (wavPath, mp3Path, bitrate) => {
  // The binary is invoked directly rather than through `npx … --shell`: this
  // repository's path contains a space, and a shell-quoted argv loses it.
  await run(
    FFMPEG,
    ['-y', '-loglevel', 'error', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', bitrate, mp3Path],
    { maxBuffer: 1 << 24 },
  );
  await rm(wavPath, { force: true });
};

const main = async () => {
  await mkdir(OUT, { recursive: true });
  const timing = JSON.parse(await readFile(path.join(ROOT, 'src', 'timing.json'), 'utf8'));

  const score = buildScore(timing);
  const scoreWav = path.join(OUT, 'score.wav');
  await writeFile(scoreWav, encodeWav(score.left, score.right));
  await toMp3(scoreWav, path.join(OUT, 'score.mp3'), '160k');
  console.log(`score.mp3   ${score.seconds.toFixed(1)}s`);

  for (const [name, make] of Object.entries(EFFECTS)) {
    const m = make();
    const wav = path.join(OUT, `${name}.wav`);
    await writeFile(wav, encodeWav(m, m));
    // Effects are short and transient-heavy; they get the higher bitrate.
    await toMp3(wav, path.join(OUT, `${name}.mp3`), '192k');
    console.log(`${name}.mp3`.padEnd(12) + `${(m.length / SR).toFixed(2)}s`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
