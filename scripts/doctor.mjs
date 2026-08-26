/**
 * Preflight check for a sentinel-agent run.
 *
 * ## Why this exists
 *
 * A run needs five separate things configured across two processes and the
 * harness UI: a model, a sandbox provider, an MCP connector, a skill, and an
 * operator token. Any one missing produces a 422 or a 403 *mid-run*, worded from
 * the harness's point of view rather than yours — "a referenced resource is
 * missing" does not tell you which one. This turns that into a checklist you can
 * read before starting.
 *
 * ## Why plain `.mjs` and not TypeScript
 *
 * Every check here talks to a network boundary and validates untyped JSON, so
 * static types would buy little, and adding a `tsconfig` plus `tsx` to the root
 * for one diagnostic costs more than it returns. Node 22 runs this directly.
 *
 * Usage: `npm run doctor`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TrueForge } from '@truefoundry/trueforge-sdk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Names that must match what the agent spec and harness expect. */
const EXPECTED_CONNECTOR = 'sentinel-ops';
const EXPECTED_SKILL = 'incident-response';

const C = {
  reset: '[0m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  bold: '[1m',
};

/**
 * Parse `.env` without a dependency.
 *
 * Deliberately not `node --env-file`: that throws when the file is absent, and a
 * missing `.env` is the single most likely thing this script needs to *report*
 * rather than crash on.
 */
function readEnvFile() {
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8');
    const out = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return { found: true, env: out };
  } catch {
    return { found: false, env: {} };
  }
}

const results = [];

/** `state` is 'ok' | 'fail' | 'warn'. `fix` is shown only when not ok. */
function record(state, label, detail, fix) {
  results.push({ state, label, detail, fix });
}

// ── Checks ──────────────────────────────────────────────────────────────────

function checkEnv(env, envFound) {
  if (!envFound) {
    record(
      'fail',
      '.env file',
      'not found at the repository root',
      'cp .env.example .env  — then fill in SENTINEL_MODEL and SENTINEL_UI_TOKEN',
    );
    return;
  }
  record('ok', '.env file', 'present');

  if (env.SENTINEL_MODEL) {
    // provider/model is the harness's required shape; a bare model id 422s with
    // no indication that the format is the problem.
    const shaped = env.SENTINEL_MODEL.includes('/');
    record(
      shaped ? 'ok' : 'fail',
      'SENTINEL_MODEL',
      env.SENTINEL_MODEL,
      shaped
        ? undefined
        : 'Must be provider/model, e.g. anthropic/claude-sonnet-4-6. A bare model id is rejected.',
    );
  } else {
    record(
      'fail',
      'SENTINEL_MODEL',
      'not set',
      'Set it to a model configured in the harness, as provider/model.',
    );
  }

  if (env.SENTINEL_UI_TOKEN) {
    record('ok', 'SENTINEL_UI_TOKEN', `set (${env.SENTINEL_UI_TOKEN.length} chars)`);
  } else {
    record(
      'fail',
      'SENTINEL_UI_TOKEN',
      'not set — approvals and cancellations will be refused',
      'Generate one: openssl rand -hex 24 — then paste the same value into the UI when prompted.',
    );
  }

  record(
    env.OPS_MCP_TOKEN ? 'ok' : 'warn',
    'OPS_MCP_TOKEN',
    env.OPS_MCP_TOKEN
      ? 'set — remember to add it as Header auth on the connector'
      : 'not set: /mcp is protected only by loopback binding',
    env.OPS_MCP_TOKEN
      ? undefined
      : 'Optional locally. Required if OPS_MCP_HOST is anything but 127.0.0.1.',
  );
}

async function checkOpsServer(env) {
  const port = env.OPS_MCP_PORT || '8940';
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(3000) });
    if (!health.ok) throw new Error(`status ${health.status}`);
    const body = await health.json();
    record('ok', 'ops MCP server', `${body.server} v${body.version} on ${base}`);
  } catch (error) {
    record(
      'fail',
      'ops MCP server',
      `not reachable at ${base} (${error instanceof Error ? error.message : error})`,
      'npm run dev:mcp',
    );
    return;
  }

  // The safety model lives in these annotations, so verify them on the wire
  // rather than trusting the unit tests. An unannotated tool is exempt from
  // approval, which is the one failure that looks like success.
  try {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    if (env.OPS_MCP_TOKEN) headers.authorization = `Bearer ${env.OPS_MCP_TOKEN}`;

    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 401) {
      record(
        'fail',
        'ops MCP auth',
        'server requires a token that does not match OPS_MCP_TOKEN in .env',
        'Make the two match, and use the same value as the connector Header auth.',
      );
      return;
    }

    const text = await res.text();
    const line = text
      .split('\n')
      .map((l) => l.replace(/^data: /, ''))
      .find((l) => l.trim().startsWith('{'));
    const tools = JSON.parse(line).result.tools;

    const unannotated = tools.filter((t) => !t.annotations);
    const gated = tools.filter((t) => t.annotations?.readOnlyHint === false);

    if (unannotated.length > 0) {
      record(
        'fail',
        'tool annotations',
        `${unannotated.length} of ${tools.length} unannotated: ${unannotated.map((t) => t.name).join(', ')}`,
        'An unannotated tool matches no approval tag and runs WITHOUT a prompt. Classify it in defineTool().',
      );
    } else {
      record(
        'ok',
        'tool annotations',
        `${tools.length} tools, 0 unannotated, ${gated.length} approval-gated`,
      );
    }
  } catch (error) {
    record(
      'warn',
      'tool annotations',
      `could not verify (${error instanceof Error ? error.message : error})`,
      'The server answered /healthz but not tools/list. Check its logs.',
    );
  }
}

async function checkHarness(env) {
  const baseUrl = env.TRUEFORGE_BASE_URL || 'http://localhost:8790';
  const client = new TrueForge({
    baseUrl,
    timeoutInSeconds: 10,
    ...(env.TRUEFORGE_TOKEN ? { token: env.TRUEFORGE_TOKEN } : {}),
  });

  // Model providers double as the reachability probe: if this call succeeds the
  // harness is up, so a separate ping would only add a failure mode.
  let providers;
  try {
    const { data } = await client.settings.modelProviders.list();
    providers = data;
    record('ok', 'harness', `reachable at ${baseUrl}`);
  } catch (error) {
    record(
      'fail',
      'harness',
      `not reachable at ${baseUrl} (${error instanceof Error ? error.message : error})`,
      'npx @truefoundry/trueforge@latest',
    );
    return;
  }

  const list = Array.isArray(providers) ? providers : (providers?.data ?? []);
  if (list.length === 0) {
    record(
      'fail',
      'model provider',
      'none configured',
      'Harness UI → Settings → Models → add your provider and key.',
    );
  } else {
    const ids = list.map((p) => p.type ?? p.id ?? p.name).filter(Boolean);
    record('ok', 'model provider', ids.length ? ids.join(', ') : `${list.length} configured`);

    // The model must belong to a configured provider, or the turn 422s.
    const wanted = (env.SENTINEL_MODEL ?? '').split('/')[0];
    if (wanted && ids.length && !ids.some((id) => String(id).includes(wanted))) {
      record(
        'warn',
        'model / provider match',
        `SENTINEL_MODEL starts with "${wanted}" but configured providers are: ${ids.join(', ')}`,
        'Either configure that provider, or point SENTINEL_MODEL at one you have.',
      );
    }
  }

  await checkSandbox(client);
  await checkConnector(client);
  await checkSkill(client);
}

async function checkSandbox(client) {
  // One provider per tenant, hence get() rather than list().
  //
  // No configured provider is not unconditionally fatal: on Linux/macOS,
  // TrueForge falls back to a LocalSandboxProvider (visible in the harness's
  // own startup log as "Local sandbox fallback is available"). It is Daytona's
  // catalog entry that is exclusive, not the runtime's only option — so this
  // is reported as a warning with the platform-appropriate fix, not a blocker.
  try {
    const { data } = await client.settings.sandboxProviders.get();
    const type = data?.manifest?.type ?? data?.type;
    if (type) {
      record('ok', 'sandbox provider', String(type));
      return;
    }
  } catch {
    // Falls through to the fallback-aware warning below.
  }

  const fallbackAvailable = process.platform === 'linux' || process.platform === 'darwin';
  record(
    fallbackAvailable ? 'warn' : 'fail',
    'sandbox provider',
    fallbackAvailable
      ? 'none configured — local sandbox fallback should cover it on this platform'
      : 'none configured, and no local fallback on Windows — sandbox AND skills will both fail',
    fallbackAvailable
      ? 'Confirm the harness log said "Local sandbox fallback is available". If not, or for reliability, register Daytona: Settings → Sandbox providers.'
      : 'The local sandbox fallback is Linux/macOS only. Register Daytona (Settings → Sandbox providers) or run the harness under WSL.',
  );
}

async function checkConnector(client) {
  try {
    const { data } = await client.settings.mcpServers.list();
    const list = Array.isArray(data) ? data : (data?.data ?? []);
    const names = list.map((s) => s.name ?? s.manifest?.name).filter(Boolean);

    if (names.includes(EXPECTED_CONNECTOR)) {
      record('ok', `connector '${EXPECTED_CONNECTOR}'`, 'registered');
    } else {
      record(
        'fail',
        `connector '${EXPECTED_CONNECTOR}'`,
        names.length ? `not found. Registered: ${names.join(', ')}` : 'no connectors registered',
        `Harness UI → Settings → Connectors → Add MCP Server. Name must be exactly '${EXPECTED_CONNECTOR}' — the agent spec references it by name.`,
      );
    }
  } catch (error) {
    record(
      'warn',
      `connector '${EXPECTED_CONNECTOR}'`,
      `could not list (${error instanceof Error ? error.message : error})`,
    );
  }
}

async function checkSkill(client) {
  try {
    const { data } = await client.settings.skills.list();
    const list = Array.isArray(data) ? data : (data?.data ?? []);
    const names = list.map((s) => s.name ?? s.manifest?.name).filter(Boolean);

    if (names.includes(EXPECTED_SKILL)) {
      record('ok', `skill '${EXPECTED_SKILL}'`, 'registered');
    } else {
      record(
        'fail',
        `skill '${EXPECTED_SKILL}'`,
        names.length ? `not found. Registered: ${names.join(', ')}` : 'no skills registered',
        `Harness UI → Settings → Skills → url https://github.com/PrinceXDev/sentinel-agent, ref main, path skills/${EXPECTED_SKILL}. Requires a sandbox provider.`,
      );
    }
  } catch (error) {
    record(
      'warn',
      `skill '${EXPECTED_SKILL}'`,
      `could not list (${error instanceof Error ? error.message : error})`,
    );
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────

const { found, env } = readEnvFile();
// Real environment wins, so CI and one-off overrides behave as expected.
const merged = { ...env, ...process.env };

console.log(`\n${C.bold}sentinel-agent preflight${C.reset}\n`);

checkEnv(merged, found);
await checkOpsServer(merged);
await checkHarness(merged);

const ICON = {
  ok: `${C.green}✓${C.reset}`,
  fail: `${C.red}✗${C.reset}`,
  warn: `${C.yellow}!${C.reset}`,
};

for (const r of results) {
  console.log(`  ${ICON[r.state]} ${r.label.padEnd(24)} ${C.dim}${r.detail ?? ''}${C.reset}`);
  if (r.state !== 'ok' && r.fix) console.log(`    ${C.dim}→ ${r.fix}${C.reset}`);
}

const failed = results.filter((r) => r.state === 'fail').length;
const warned = results.filter((r) => r.state === 'warn').length;

console.log();
if (failed > 0) {
  console.log(
    `${C.red}${failed} blocking issue${failed === 1 ? '' : 's'}${C.reset} — a run will not complete until these are fixed.\n`,
  );
  process.exit(1);
}
console.log(
  `${C.green}Ready to run.${C.reset}${warned ? ` ${warned} warning${warned === 1 ? '' : 's'} above.` : ''}\n`,
);
