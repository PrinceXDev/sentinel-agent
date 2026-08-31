# sentinel-agent — product film

A ~6:49 cinematic product film, built with [Remotion](https://www.remotion.dev/docs).
Code-driven, deterministic, and re-renderable from this directory alone.

```bash
cd video
npm install
npm run studio        # preview in Remotion Studio
npm run render        # → out/sentinel-agent.mp4  (1920×1080, 30fps, H.264)
```

---

## What is real in it

Everything. This is the constraint the whole project is built on, so the film is
held to it too.

| On screen | Where it came from |
| --- | --- |
| Every product panel | Screenshots of the deployed site, captured by `npm run capture` |
| The console showing a completed run | The real operator console, reading the estate the agent actually mutated |
| `298 tests passing` | `npm test` in this repository — 118 MCP + 125 UI + 55 script |
| `13/13 tools annotated, 5 gated` | `npm run doctor` against the live ops MCP server |
| The four Gate Prover verdicts | [`reports/gate-conformance.json`](../reports/gate-conformance.json) |
| The injected note | `search-injected-note`, verbatim from the scenario fixture |
| `3.70×`, `178 → 658ms`, `15.3×`, flat throughput | The seeded estate's own deterministic series |
| The rollback, the recovery, `mitigated` | **One live run**, recorded by `npm run demo:run` |
| `21 findings, all addressed` | The four Qodo-reviewed PRs listed in the root README |

Two verdicts in the proof act are deliberately **not** a pass — `not reached` and
`route not taken` — because the report says so. Nothing was upgraded for the film.

### The live run

`scripts/demo-run.mjs` drives a real TrueForge harness the way `scripts/bench.mjs`
does: it builds the agent spec from the committed manifest, creates a session,
streams the turn, approves each gated call when the harness asks, and continues
until the run finishes. What that run produced:

- **6** gated calls held by the harness, **6** approved by a human
- **6** subagent threads
- **10** evidence claims, each paired with the tool call or subagent that produced it
- `record_finding` at 95% confidence → `audit_finding` came back at **72%**,
  `partially_supported`, with 2 unsupported claims. The agent then gathered more
  evidence, and a second audit returned **93%**, `supported`, 0 unsupported.
- `rollback_deployment` — `dpl-4c21` → `dpl-4c20`
- Verification: p95 **657.7ms → 177.6ms**, error rate **6.2% → 0.37%**, ~3 minutes
- Incident status: **mitigated**

The transcript is in `src/run.json`; the estate's own record is in
`src/estate-{audit,findings,state}.json`.

---

## Structure

```
video/
├── src/
│   ├── Root.tsx                  Composition registry
│   ├── timing.json               The cut list — generated, never hand-edited
│   ├── run.json                  Transcript of the live run
│   ├── theme.ts                  Palette and type scale, taken from the product
│   ├── lib/
│   │   ├── timeline.ts           Scene and cue lookup from timing.json
│   │   └── anim.ts               Springs, fades, camera, wipes
│   ├── components/               Backdrop, Type, Shot, Terminal, Diagram, Sfx
│   ├── scenes/                   act0-ColdOpen … act8-Finale
│   └── compositions/
│       └── HackathonFilm.tsx     Lays scenes out and mixes the three audio layers
├── public/
│   ├── shots/                    Captured product footage (3× DPI)
│   ├── vo/                       One MP3 per narrated line
│   └── audio/                    Synthesised score and effects
└── scripts/                      capture, vo, score, demo-run, srt
```

### The cut is derived, not declared

No scene declares a duration. `scripts/narration.mjs` holds the script; `npm run vo`
synthesises each line, measures it, and writes `src/timing.json`; every scene reads
its length from there. Rewrite a line and re-run the voice, and the picture re-cuts
itself — a scene cannot drift out of sync with the sentence it illustrates.

---

## Sound

Narration is neural TTS (`en-US-AndrewMultilingualNeural`). The score and the whole
effects kit are **synthesised from code** in `scripts/make-audio.mjs` — no sampled or
licensed material — so the audio is deterministic, redistributable with the
repository, and exactly as long as the picture. The score reads the same
`timing.json` the picture does and shapes itself around the acts, and it ducks under
every spoken line so the voice always wins.

Replace the narration with a human recording by dropping same-named MP3s into
`public/vo/` and re-running `npm run vo` (measured lengths are cached per line, so
only changed lines re-synthesise).

---

## Rebuilding from scratch

```bash
npm run capture        # product footage from the deployed site
npm run vo             # narration + timing.json  (needs the TTS venv, below)
npm run score          # score.wav + the effects kit
npm run render
```

The TTS environment is created once:

```bash
python -m venv .venv && .venv/Scripts/python.exe -m pip install edge-tts
```

Optional, and only if you want to re-record the live run:

```bash
npm run demo:run       # needs a running harness — see the root README
```

To capture the console showing a completed run when the harness is running under
WSL, `scripts/wsl-proxy.mjs` exposes it on a loopback origin (Next's dev server
refuses non-loopback Hosts), then `npm run capture:console` takes the shots.

---

## Timeline

| Time | Act |
| --- | --- |
| 0:00 | Cold open — the incident, and the reversal |
| 0:22 | Act I — the problem, and the two ways people get it wrong |
| 0:55 | Act II — the insight: investigation automated, execution authorised |
| 1:12 | Act III — the run: MCP, subagents, raw samples, sandbox, mechanism |
| 2:24 | Act IV — the gate holds |
| 2:45 | The wait (fast-forwarded) |
| 3:06 | Act V — architecture, and the annotation bug |
| 4:03 | Act VI — proof: tests, the Gate Prover, prompt injection, review |
| 5:25 | Act VII — approval, execution, verification, run complete |
| 6:16 | Act VIII — impact, finale, credits |

Full script with timecodes: `NARRATION.md` · subtitles: `out/sentinel-agent.srt`
