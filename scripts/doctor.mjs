/**
 * Preflight check for a sentinel-agent run.
 *
 * ## Why this exists
 *
 * A run needs six separate things configured across two processes and the
 * harness UI: a model, a sandbox provider, an MCP connector, a skill, the agent
 * itself, and an operator token. Any one missing produces a 422 or a 403
 * *mid-run*, worded from the harness's point of view rather than yours — "a
 * referenced resource is missing" does not tell you which one. This turns that
 * into a checklist you can read before starting.
 *
 * The agent check goes further than presence. `require_approval_for_tools` is
 * API-only and invisible in the harness UI, so a saved agent whose policy has
 * drifted from the committed spec would gate less than this repository claims,
 * with nothing on screen saying so.
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
const EXPECTED_AGENT = 'sentinel-agent';

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
  // `env` here is already the merged view (file + real process.env — see the
  // call site), so a missing file does not mean missing values: CI, a shell
  // profile, or `docker run -e` can supply every variable below with no `.env`
  // on disk at all. This used to `return` immediately on a missing file,
  // which meant every check below it — including whether SENTINEL_UI_TOKEN is
  // set at all — silently never ran, so those checks always looked passing by
  // omission rather than by verification. File presence is informational now;
  // it no longer gates whether the merged values get checked.
  record(
    envFound ? 'ok' : 'warn',
    '.env file',
    envFound
      ? 'present'
      : 'not found — checking process environment for the required values instead',
    envFound
      ? undefined
      : 'cp .env.example .env  — then fill in SENTINEL_MODEL and SENTINEL_UI_TOKEN, or export them directly.',
  );

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
  // Was hardcoded to 127.0.0.1, silently ignoring OPS_MCP_HOST — so probing a
  // deliberately non-default host (see docs/architecture.md § Trust model)
  // would always report "not reachable" against the wrong address instead of
  // reflecting the config actually in use.
  const host = env.OPS_MCP_HOST || '127.0.0.1';
  const base = `http://${host}:${port}`;

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
    // A warning here would mean this doctor exits 0 on a config it never
    // actually verified — the annotation check exists specifically to catch
    // an unannotated destructive tool that runs with no approval prompt, and
    // "could not verify" is not evidence that isn't happening.
    record(
      'fail',
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
  await checkAgent(client);
}

/**
 * Look for the harness's own confirmation that it is running a local sandbox
 * fallback, rather than assuming one from `process.platform` alone.
 *
 * `wsl-up.sh` redirects the harness's stdout to this fixed path, so when
 * doctor runs in that same environment the evidence is directly readable.
 * Returns `null` — not `false` — when the log cannot be read, so the caller
 * can tell "confirmed absent" apart from "unable to check" instead of
 * collapsing both into the same platform guess this replaces.
 */
function localSandboxFallbackConfirmed() {
  try {
    const log = readFileSync('/tmp/tf-harness.log', 'utf8');
    return log.includes('Local sandbox fallback is available');
  } catch {
    return null;
  }
}

async function checkSandbox(client) {
  // One provider per tenant, hence get() rather than list().
  try {
    const { data } = await client.settings.sandboxProviders.get();
    const type = data?.manifest?.type ?? data?.type;
    if (type) {
      record('ok', 'sandbox provider', String(type));
      return;
    }
  } catch {
    // Falls through to the fallback check below.
  }

  // No configured provider is not unconditionally fatal: on Linux/macOS,
  // TrueForge falls back to a LocalSandboxProvider. Daytona's catalog entry
  // being the only *configurable* provider does not mean it is the only
  // *runtime* option — but that fallback needs to be confirmed from the
  // harness's own log, not inferred from `process.platform`, which is true of
  // the machine running this script and says nothing about whether the
  // harness process actually logged that fallback active.
  const confirmed = localSandboxFallbackConfirmed();

  if (confirmed === true) {
    record(
      'ok',
      'sandbox provider',
      'none configured — local fallback confirmed active in harness log',
    );
    return;
  }

  if (confirmed === false) {
    record(
      'fail',
      'sandbox provider',
      'none configured, and the harness log does not show the local fallback active',
      'Register Daytona (Settings → Sandbox providers), or check why the fallback did not start.',
    );
    return;
  }

  // confirmed === null: the log was not readable from here (a different
  // machine, a different log path, doctor run outside the environment
  // wsl-up.sh writes to). Unverified, not confirmed absent — so this still
  // has to block rather than assume the platform-appropriate default happened.
  record(
    'fail',
    'sandbox provider',
    'none configured, and its fallback log could not be read from here to confirm one is active',
    'Register Daytona (Settings → Sandbox providers), or run doctor where /tmp/tf-harness.log is readable.',
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
    // The connector is a hard dependency — nothing runs without it. An API
    // error here means the check could not confirm it exists, which is not the
    // same as it existing, so this cannot be a warning without doctor exiting
    // 0 on a setup that has not actually been verified.
    record(
      'fail',
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
    // Same reasoning as the connector check above: the skill is required for
    // the investigation methodology to load at all, so an unverifiable state
    // must block, not warn.
    record(
      'fail',
      `skill '${EXPECTED_SKILL}'`,
      `could not list (${error instanceof Error ? error.message : error})`,
    );
  }
}

/** The approval selectors the committed spec declares for the ops connector. */
function committedApprovalPolicy() {
  try {
    const spec = JSON.parse(readFileSync(join(ROOT, 'agent', 'sentinel-agent.agent.json'), 'utf8'));
    return (
      spec.mcp_servers?.find((m) => m.name === EXPECTED_CONNECTOR)?.require_approval_for_tools ?? []
    );
  } catch {
    return [];
  }
}

/**
 * The saved agent, and whether its approval policy still matches the repo.
 *
 * A registered agent is not enough on its own. `require_approval_for_tools`
 * lives in the manifest and is API-only — it cannot be set or inspected in the
 * UI — so a saved agent whose policy has drifted from the committed spec would
 * run with gating this repository no longer describes, and nothing on screen
 * would say so. That is the silent-bypass failure mode in a different costume,
 * which makes it worth a check rather than an assumption.
 *
 * Absence is a warning rather than a failure: the scripts drive the harness with
 * an inline spec and do not need a saved agent at all. It is the harness UI that
 * does, so this blocks a demo, not a conformance run.
 */
async function checkAgent(client) {
  try {
    const { data } = await client.agents.list();
    const list = Array.isArray(data) ? data : (data?.data ?? []);
    const agent = list.find((a) => (a.name ?? a.manifest?.name) === EXPECTED_AGENT);

    if (!agent) {
      const names = list.map((a) => a.name ?? a.manifest?.name).filter(Boolean);
      record(
        'warn',
        `agent '${EXPECTED_AGENT}'`,
        names.length ? `not found. Registered: ${names.join(', ')}` : 'no agents registered',
        'npm run provision registers it. Only needed to drive the agent from the harness UI — prove:gate and bench use an inline spec.',
      );
      return;
    }

    // Both casings are accepted because the SDK is not symmetric: it serialises
    // the manifest to snake_case on the wire, exactly as the committed spec is
    // written, but deserialises the response back into camelCase. Reading only
    // `mcp_servers` here found nothing on a perfectly healthy agent and reported
    // that it gated nothing — a false alarm about the approval policy, which is
    // the one thing this check exists to be trusted about.
    const servers = agent.manifest?.mcp_servers ?? agent.manifest?.mcpServers ?? [];
    const ops = servers.find((m) => m.name === EXPECTED_CONNECTOR);
    const policy = ops?.require_approval_for_tools ?? ops?.requireApprovalForTools;

    if (!Array.isArray(policy) || policy.length === 0) {
      record(
        'fail',
        `agent '${EXPECTED_AGENT}'`,
        'registered, but its saved manifest gates nothing — every destructive tool would run unprompted',
        'npm run provision updates it in place from agent/sentinel-agent.agent.json.',
      );
      return;
    }

    // Compared against the committed spec rather than a list of tool names kept
    // here. A second copy of "which tools are dangerous" is a second thing to
    // forget to update, and the committed spec is already the source of truth
    // that `registry.test.ts` asserts against.
    const expected = committedApprovalPolicy();
    const missing = expected.filter((selector) => !policy.includes(selector));
    if (missing.length > 0) {
      record(
        'fail',
        `agent '${EXPECTED_AGENT}'`,
        `registered, but its policy is missing ${missing.join(', ')} — the saved manifest has drifted from the committed spec`,
        'npm run provision updates it in place from agent/sentinel-agent.agent.json.',
      );
      return;
    }

    record('ok', `agent '${EXPECTED_AGENT}'`, `registered, ${policy.length} approval selectors`);
  } catch (error) {
    record(
      'warn',
      `agent '${EXPECTED_AGENT}'`,
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
