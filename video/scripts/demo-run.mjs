/**
 * Records one real, complete incident run — for the film to replay frame-exact.
 *
 * This drives a live TrueForge harness the same way `scripts/bench.mjs` does: it
 * builds the agent spec from the committed manifest, creates a session, streams
 * the turn, approves the gated call when the harness asks, and keeps going until
 * the run finishes. Then it reads the estate's own audit log and finding as an
 * independent record of what actually changed.
 *
 * The output, `src/run.json`, is what the film's console scenes render. Nothing
 * in the resolution act is written by hand — the tool names, the timings, the
 * subagent briefs, the approval case and the recovered metrics all come from
 * this file, so the film cannot claim a step the agent did not take.
 *
 * Credentials are read from `.env` by the same loader the repository's own
 * scripts use and are never printed.
 *
 *   node scripts/demo-run.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TrueForge } from '../../node_modules/@truefoundry/trueforge-sdk/dist/esm/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = join(HERE, '..');
const REPO_ROOT = join(VIDEO_ROOT, '..');

const readEnvFile = () => {
  try {
    const raw = readFileSync(join(REPO_ROOT, '.env'), 'utf8');
    const out = {};
    for (const l of raw.split('\n')) {
      const t = l.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[t.slice(0, eq).trim()] = v;
    }
    return out;
  } catch {
    return {};
  }
};

const env = { ...readEnvFile(), ...process.env };
const HARNESS = env.TRUEFORGE_BASE_URL || 'http://localhost:8790';
const OPS = `http://127.0.0.1:${env.OPS_MCP_PORT || '8940'}`;
const MODEL = env.SENTINEL_MODEL?.trim();

if (!MODEL) {
  console.error('SENTINEL_MODEL is not set in .env');
  process.exit(1);
}

const PROMPT =
  'Investigate incident INC-2048. Checkout latency has risen sharply on checkout-api. ' +
  'Determine whether the most recent deployment caused it, compute the magnitude from ' +
  'raw metrics, and prepare a remediation if the evidence supports one.';

/** The shipped spec, verbatim apart from the model placeholder. */
const spec = (() => {
  const raw = JSON.parse(
    readFileSync(join(REPO_ROOT, 'agent', 'sentinel-agent.agent.json'), 'utf8'),
  );
  return { ...raw, model: { ...raw.model, name: MODEL } };
})();

const opsGet = async (path) => {
  const headers = {};
  if (env.OPS_MCP_TOKEN) headers.Authorization = `Bearer ${env.OPS_MCP_TOKEN}`;
  const res = await fetch(`${OPS}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
};

const tf = new TrueForge({
  baseUrl: HARNESS,
  ...(env.TRUEFORGE_TOKEN ? { token: env.TRUEFORGE_TOKEN } : {}),
});

const started = Date.now();
/** Every event, flattened to what the film needs and nothing more. */
const events = [];
const pending = [];

const at = () => (Date.now() - started) / 1000;

const push = (kind, payload) => {
  events.push({ t: Number(at().toFixed(2)), kind, ...payload });
};

const consume = async (stream) => {
  for await (const ev of stream) {
    const type = ev.type;

    if (type === 'model.message') {
      for (const call of ev.toolCalls ?? ev.tool_calls ?? []) {
        push('tool_call', {
          id: call.id,
          name: call.name,
          args: typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments ?? {}),
        });
        console.log(`  ${at().toFixed(1).padStart(6)}s  call     ${call.name}`);
      }
      const text = ev.content ?? ev.text;
      if (typeof text === 'string' && text.trim()) {
        push('message', { text: text.trim().slice(0, 4000) });
      }
    }

    if (type === 'tool.response') {
      const name = ev.name ?? ev.toolName ?? ev.tool_name;
      const raw = ev.content ?? ev.result ?? ev.output;
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? null);
      push('tool_response', {
        id: ev.toolCallId ?? ev.tool_call_id,
        name,
        // Truncated: the film shows shapes and headline numbers, not payloads.
        preview: (text ?? '').slice(0, 1200),
        bytes: (text ?? '').length,
      });
      console.log(`  ${at().toFixed(1).padStart(6)}s  result   ${name ?? '?'} (${(text ?? '').length}b)`);
    }

    if (type === 'tool.approval_required') {
      for (const call of ev.toolCalls ?? ev.tool_calls ?? []) {
        pending.push({ threadId: ev.threadId ?? ev.thread_id, toolCallId: call.id });
        push('approval_required', { id: call.id, sourceEventId: call.sourceEventId ?? call.source_event_id });
        console.log(`  ${at().toFixed(1).padStart(6)}s  GATE     approval required (${call.id})`);
      }
    }

    if (type === 'turn.done' || type === 'turn.created') {
      push(type === 'turn.done' ? 'turn_done' : 'turn_created', {});
    }

    // Anything unrecognised is still recorded, so the transcript is complete.
    if (
      ![
        'model.message',
        'model.message.delta',
        'tool.response',
        'tool.approval_required',
        'turn.done',
        'turn.created',
      ].includes(type)
    ) {
      push('other', { type });
    }
  }
};

console.log(`\nsentinel-agent — recording a live run\n  harness ${HARNESS}\n  model   ${MODEL}\n`);

const { data: session } = await tf.sessions.create({ agent: { spec } });
console.log(`  session ${session.id}\n`);

await consume(
  await tf.sessions.createTurnStream(session.id, {
    input: [{ type: 'user.message', content: PROMPT }],
  }),
);

/**
 * The approval.
 *
 * A human decision, made here so the recording captures a complete run. The
 * point of the film's resolution act is what the system does *after* someone
 * says yes — the gate's own behaviour is `prove:gate`'s subject, not this
 * recording's.
 */
let rounds = 0;
while (pending.length > 0 && rounds < 12) {
  rounds += 1;
  const batch = pending.splice(0, pending.length);
  for (const p of batch) {
    push('approval_granted', { id: p.toolCallId });
    console.log(`  ${at().toFixed(1).padStart(6)}s  APPROVE  ${p.toolCallId}`);
    await consume(
      await tf.sessions.createTurnStream(session.id, {
        input: [
          {
            type: 'user.tool_approval',
            threadId: p.threadId,
            toolCallId: p.toolCallId,
            approval: { status: 'allow' },
          },
        ],
      }),
    );
  }
}

const [state, audit, findings] = await Promise.all([
  opsGet('/estate/state').catch(() => null),
  opsGet('/estate/audit').catch(() => null),
  opsGet('/estate/findings').catch(() => null),
]);

const toolCalls = events.filter((e) => e.kind === 'tool_call');
const counts = {};
for (const c of toolCalls) counts[c.name] = (counts[c.name] ?? 0) + 1;

const out = {
  recorded_at: new Date().toISOString(),
  harness: HARNESS,
  model: MODEL,
  session_id: session.id,
  prompt: PROMPT,
  duration_seconds: Number(at().toFixed(2)),
  tool_call_count: toolCalls.length,
  tool_counts: counts,
  approvals: events.filter((e) => e.kind === 'approval_granted').length,
  events,
  estate: { state, audit, findings },
};

mkdirSync(join(VIDEO_ROOT, 'src'), { recursive: true });
writeFileSync(join(VIDEO_ROOT, 'src', 'run.json'), `${JSON.stringify(out, null, 2)}\n`);

console.log(`\n  ${toolCalls.length} tool calls · ${out.approvals} approval(s) · ${out.duration_seconds}s`);
console.log(`  tools: ${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ')}`);
console.log(`\n  written → src/run.json\n`);
