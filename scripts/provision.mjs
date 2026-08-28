/**
 * Register the harness resources sentinel-agent needs, idempotently.
 *
 * ## Why this exists
 *
 * `doctor` tells you the `sentinel-ops` connector and the `incident-response`
 * skill are missing. It then tells you to go and click through the harness UI to
 * add them — twice, with a name that must match the agent spec *exactly*,
 * because `mcp_servers[].name` is resolved by string. A typo there produces a
 * 422 at turn time worded as a missing resource, which is the same symptom as
 * having registered nothing at all.
 *
 * That is a setup step with a silent failure mode, performed by hand, that the
 * API can do exactly. So it is done here instead.
 *
 * Both operations are create-if-absent. Re-running is safe and reports what was
 * already there rather than failing on a conflict.
 *
 * ## The model provider, and where the key lives
 *
 * A provider needs a real API key, so this is the one place in the repository
 * that handles a credential. It handles it exactly once: read from `.env`
 * (gitignored), POSTed to the harness, never touched again. From then on the
 * harness holds it and makes every model call itself — nothing under `apps/`,
 * and nothing in the sandbox, ever sees it. That is what keeps the
 * credential-boundary claim in docs/architecture.md true rather than aspirational.
 *
 * The key must never go in `.env.example`. That file is committed and pushed, so
 * a key in it is a public key — and the hackathon rules require credentials be
 * kept out of the repo. `.env.example` carries the empty placeholder only.
 *
 * Skipped, not failed, when no key is set: the connector and skill are still
 * worth registering, and `doctor` already reports a missing provider clearly.
 *
 * Usage:
 *   node scripts/provision.mjs           # provider + connector + skill
 *   node scripts/provision.mjs --lab     # also the unannotated-twin connector
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TrueForge } from '@truefoundry/trueforge-sdk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const C = {
  reset: '[0m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  bold: '[1m',
};

/** Same minimal parser as doctor.mjs — a missing .env must be reportable, not fatal. */
function readEnvFile() {
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8');
    const out = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[trimmed.slice(0, eq).trim()] = value;
    }
    return out;
  } catch {
    return {};
  }
}

const env = { ...readEnvFile(), ...process.env };
const LAB = process.argv.includes('--lab');

const PORT = env.OPS_MCP_PORT || '8940';

/**
 * Where the harness should reach the ops server.
 *
 * Derived from `OPS_MCP_HOST`, the same variable the server binds to and doctor
 * probes. Hardcoding loopback here was wrong: a server deliberately bound to a
 * specific interface need not accept traffic addressed to `127.0.0.1`, so the
 * generated connectors would point at an address nothing was listening on — and
 * the resulting failure surfaces as a tool-loading error, not a connection one.
 *
 * Wildcard binds are the exception. `0.0.0.0` and `::` mean "every interface",
 * which is a *listen* address and not a valid destination, so those are mapped
 * to loopback — the one address a wildcard bind is guaranteed to answer on from
 * the same host.
 */
const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '[::]', '*']);
const CONFIGURED_HOST = env.OPS_MCP_HOST?.trim() || '127.0.0.1';
const OPS_HOST = WILDCARD_HOSTS.has(CONFIGURED_HOST) ? '127.0.0.1' : CONFIGURED_HOST;

/** Bracket a bare IPv6 literal so it is a valid URL authority. */
const OPS_AUTHORITY =
  OPS_HOST.includes(':') && !OPS_HOST.startsWith('[') ? `[${OPS_HOST}]` : OPS_HOST;

const OPS_BASE = `http://${OPS_AUTHORITY}:${PORT}`;

/**
 * The repository the skill is loaded from.
 *
 * TrueForge fetches skills over git from a public github.com/gitlab.com URL —
 * there is no private-repo credential field — so this must point at the pushed
 * public repo, and `ref` must name a branch that actually contains the skill.
 */
const SKILL_URL = env.SENTINEL_SKILL_URL || 'https://github.com/PrinceXDev/sentinel-agent';
const SKILL_REF = env.SENTINEL_SKILL_REF || 'main';

const results = [];
const record = (state, label, detail, fix) => results.push({ state, label, detail, fix });

function client() {
  return new TrueForge({
    baseUrl: env.TRUEFORGE_BASE_URL || 'http://localhost:8790',
    timeoutInSeconds: 20,
    ...(env.TRUEFORGE_TOKEN ? { token: env.TRUEFORGE_TOKEN } : {}),
  });
}

/** Unwrap the two list shapes the harness returns depending on endpoint. */
function asList(data) {
  return Array.isArray(data) ? data : (data?.data ?? []);
}

function namesOf(list) {
  return list.map((s) => s.name ?? s.manifest?.name).filter(Boolean);
}

/** Which env var holds the token guarding a connector's endpoint. */
function tokenVarFor(name) {
  // The lab connector points at /mcp-unsafe (OPS_LAB_TOKEN); everything else
  // points at /mcp (OPS_MCP_TOKEN). Attaching the wrong one yields a 401 the
  // harness reports as a tool-loading failure, so they are not interchangeable.
  return name.endsWith('-unsafe') ? 'OPS_LAB_TOKEN' : 'OPS_MCP_TOKEN';
}

/**
 * Report a connector that already exists, and the trap that hides behind it.
 *
 * A connector registered while its token was unset carries no Authorization
 * header. Setting the token afterwards makes the server reject it with a 401,
 * which the harness surfaces as a tool-loading failure mid-run with nothing
 * pointing at the cause. The list response redacts auth, so this cannot be
 * detected from here — only warned about. And since the API has no update or
 * delete for connectors (verified: PUT and DELETE both 404), the remedy really
 * is "delete it in the UI and re-run".
 */
function recordExistingConnector(name) {
  const tokenVar = tokenVarFor(name);
  const expectedToken = env[tokenVar];

  record(
    expectedToken ? 'warn' : 'ok',
    `connector '${name}'`,
    expectedToken
      ? `already registered — but ${tokenVar} is set, and this connector may predate it`
      : 'already registered — left as configured',
    expectedToken
      ? `If '${name}' was registered before the token existed it now gets 401. The API cannot update a connector, so: Settings → Connectors → delete '${name}' → re-run this command.`
      : undefined,
  );
}

async function ensureConnector(tf, { name, url, description }) {
  let existing;
  try {
    existing = namesOf(asList((await tf.settings.mcpServers.list()).data));
  } catch (error) {
    record('fail', `connector '${name}'`, `could not list (${describe(error)})`);
    return;
  }

  if (existing.includes(name)) {
    // Deliberately not updated in place: an existing connector may carry auth
    // headers the operator set by hand, and the list response redacts them, so
    // there is no way to preserve what is already there. Reporting beats
    // silently rewriting someone's configuration.
    recordExistingConnector(name);
    return;
  }

  const manifest = { name, type: 'remote', url, description };

  const token = env[tokenVarFor(name)];

  // Only attach header auth when a token is actually configured. Registering an
  // Authorization header of empty string would make every call 401 with a
  // failure that looks like the server being down.
  if (token) {
    manifest.auth = { type: 'header', headers: { Authorization: `Bearer ${token}` } };
  }

  try {
    await tf.settings.mcpServers.create({ manifest });
    record('ok', `connector '${name}'`, `registered → ${url}${token ? ' (bearer auth)' : ''}`);
  } catch (error) {
    record(
      'fail',
      `connector '${name}'`,
      `create failed (${describe(error)})`,
      `Add it by hand: Settings → Connectors → Add MCP Server, name exactly '${name}', url ${url}.`,
    );
  }
}

/**
 * The model exposed through the OpenRouter provider.
 *
 * `modelId` is what goes on the wire to OpenRouter; `name` is what the harness
 * calls it, and is the half that appears in `SENTINEL_MODEL` as
 * `<provider>/<name>`. They differ because `name` is a `ResourceName` and dots
 * read poorly in a slug, while `modelId` must match OpenRouter exactly.
 */
const PROVIDER_NAME = 'openrouter';
const MODEL_NAME = 'claude-sonnet-4-5';
const MODEL_ID = env.OPENROUTER_MODEL_ID || 'anthropic/claude-sonnet-4.5';

/**
 * Register the model provider, if a key is available.
 *
 * This is the one place a real credential is handled, and it is handled once:
 * the key is read from `.env` (gitignored), POSTed to the harness, and never
 * touched again. Every model call afterwards is made by the harness using its
 * own stored copy — nothing under `apps/` ever sees it, which is what keeps the
 * credential-boundary claim in docs/architecture.md true.
 *
 * Absent a key this is skipped rather than failed: the connector and skill are
 * still worth registering, and `doctor` already reports a missing provider.
 */
async function ensureModelProvider(tf) {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    record(
      'warn',
      'model provider',
      'OPENROUTER_API_KEY not set — skipped',
      'Put the key in .env (never .env.example — that file is committed), then re-run.',
    );
    return;
  }

  let existing;
  try {
    existing = namesOf(asList((await tf.settings.modelProviders.list()).data));
  } catch (error) {
    record('fail', 'model provider', `could not list (${describe(error)})`);
    return;
  }

  if (existing.includes(PROVIDER_NAME)) {
    // Not rotated in place. The list response redacts the stored key, so there
    // is no way to tell whether the configured one still works — and silently
    // overwriting a key the operator set by hand is worse than reporting.
    record('ok', `model provider '${PROVIDER_NAME}'`, 'already registered — left as configured');
    return;
  }

  try {
    await tf.settings.modelProviders.create({
      manifest: {
        type: 'custom',
        name: PROVIDER_NAME,
        baseUrl: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        auth: { apiKey },
        models: [
          {
            modelId: MODEL_ID,
            name: MODEL_NAME,
            properties: { contextLength: 200000, maxOutputTokens: 64000 },
          },
        ],
      },
    });
    record('ok', `model provider '${PROVIDER_NAME}'`, `registered → ${MODEL_ID}`);
  } catch (error) {
    record('fail', `model provider '${PROVIDER_NAME}'`, `create failed (${describe(error)})`);
  }
}

async function ensureSkill(tf) {
  const name = 'incident-response';
  let existing;
  try {
    existing = namesOf(asList((await tf.settings.skills.list()).data));
  } catch (error) {
    record('fail', `skill '${name}'`, `could not list (${describe(error)})`);
    return;
  }

  if (existing.includes(name)) {
    record('ok', `skill '${name}'`, 'already registered — left as configured');
    return;
  }

  try {
    await tf.settings.skills.create({
      manifest: {
        name,
        type: 'git',
        url: SKILL_URL,
        ref: SKILL_REF,
        path: 'skills/incident-response',
        description:
          'Investigate a production incident end to end — characterise the symptom, enumerate ' +
          'changes, prove a mechanism, compute magnitudes in the sandbox, and prepare a ' +
          'remediation for human approval.',
      },
    });
    record('ok', `skill '${name}'`, `registered ← ${SKILL_URL}@${SKILL_REF}`);
  } catch (error) {
    // The most common cause is the ref not existing on the public remote yet —
    // the skill is fetched over git, so an unpushed branch cannot be resolved.
    record(
      'fail',
      `skill '${name}'`,
      `create failed (${describe(error)})`,
      `Check that ${SKILL_URL} is public and that branch '${SKILL_REF}' is pushed and contains skills/incident-response. Override with SENTINEL_SKILL_REF.`,
    );
  }
}

/**
 * Keys that must never reach stdout, at any nesting depth.
 *
 * This script is the one place that POSTs a real credential, and error bodies
 * are the one place a credential comes back. A 4xx from the harness can echo the
 * offending request — which for `modelProviders.create` is the manifest,
 * `auth.apiKey` included. Printing that would put the key in a terminal
 * scrollback and, worse, in CI logs, where it outlives the process.
 */
const REDACT_KEYS = new Set(['apiKey', 'api_key', 'token', 'authorization', 'Authorization']);

/** Deep-copy a value with credential-bearing fields replaced. */
function redact(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.has(k) ? '(redacted)' : redact(v, depth + 1);
  }
  return out;
}

function describe(error) {
  if (!error) return 'unknown error';
  const body = error.body ?? error.rawResponse?.body;
  if (body && typeof body === 'object') return JSON.stringify(redact(body));
  return error instanceof Error ? error.message : String(error);
}

// ── Run ─────────────────────────────────────────────────────────────────────

console.log(`\n${C.bold}sentinel-agent provisioning${C.reset}\n`);

const tf = client();

try {
  await tf.settings.modelProviders.list();
} catch (error) {
  console.log(
    `  ${C.red}✗${C.reset} harness ${C.dim}not reachable at ${env.TRUEFORGE_BASE_URL || 'http://localhost:8790'} (${describe(error)})${C.reset}`,
  );
  console.log(`    ${C.dim}→ npx @truefoundry/trueforge@latest${C.reset}\n`);
  process.exit(1);
}

await ensureModelProvider(tf);

await ensureConnector(tf, {
  name: 'sentinel-ops',
  url: `${OPS_BASE}/mcp`,
  description:
    'Incident-response tools for a simulated production estate. Read-only tools run freely; ' +
    'writes and production mutations are approval-gated via MCP annotations.',
});

if (LAB) {
  await ensureConnector(tf, {
    name: 'sentinel-ops-unsafe',
    url: `${OPS_BASE}/mcp-unsafe`,
    description:
      'LAB ONLY. The unannotated twin of rollback_deployment, used by prove:gate to demonstrate ' +
      'that a destructive tool publishing no MCP annotations is exempt from the approval gate.',
  });
}

await ensureSkill(tf);

for (const { state, label, detail, fix } of results) {
  const mark =
    state === 'ok'
      ? `${C.green}✓${C.reset}`
      : state === 'warn'
        ? `${C.yellow}!${C.reset}`
        : `${C.red}✗${C.reset}`;
  console.log(`  ${mark} ${label.padEnd(28)} ${C.dim}${detail}${C.reset}`);
  if (fix && state !== 'ok') console.log(`    ${C.dim}→ ${fix}${C.reset}`);
}

const failed = results.filter((r) => r.state === 'fail').length;
console.log(
  failed
    ? `\n${C.red}${failed} failed${C.reset} — see above.\n`
    : `\n${C.green}Provisioned.${C.reset} ${C.dim}Set SENTINEL_MODEL=${PROVIDER_NAME}/${MODEL_NAME} in .env, then: npm run doctor${C.reset}\n`,
);
process.exit(failed ? 1 : 0);
