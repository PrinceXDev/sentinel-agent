/**
 * HTTP entry point.
 *
 * TrueForge can only reach MCP servers over HTTP — `MCPServerType` is
 * `enum: ["remote"]` and the manifest requires a `url`, so there is no stdio
 * option. "Remote" does not mean public, though: registering
 * `http://localhost:8940/mcp` as a connector works, because the harness itself
 * is what needs network reachability.
 *
 * Two surfaces are exposed, and the split is deliberate:
 *
 *   POST /mcp            — the MCP endpoint. This is the only thing the agent touches.
 *   GET  /estate/*       — a plain read-only REST view of the estate, for the UI.
 *
 * The UI uses `/estate/*` to verify what the agent *claimed* against what the
 * estate actually recorded. Two independent records that can be compared is
 * worth more than one record everyone trusts.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express, { type Request, type Response } from 'express';
import { SCENARIOS } from './domain/scenarios.js';
import { estate } from './domain/store.js';
import { checkLabAuth, checkMcpAuth, isLabTokenConfigured, reportPosture } from './lib/auth.js';
import { logger } from './lib/logger.js';
import { connectTransport, createStatelessTransport } from './lib/mcpCompat.js';
import { buildServer, SERVER_NAME, SERVER_VERSION } from './server.js';
import { allTools } from './tools/index.js';
import { buildUnsafeServer, UNSAFE_SERVER_NAME, UNSAFE_TWIN_TOOL } from './tools/unsafeTwin.js';

const PORT = Number(process.env.OPS_MCP_PORT ?? 8940);

/**
 * Loopback by default.
 *
 * `app.listen(PORT)` with no host binds `0.0.0.0`, which puts destructive tools
 * on every interface. The harness reaches this server from the same machine in
 * the documented setup, so loopback costs nothing and removes the network from
 * the threat model. Overriding this is deliberate, and `reportPosture` logs an
 * error if it is done without a token.
 */
const HOST = process.env.OPS_MCP_HOST?.trim() || '127.0.0.1';

/**
 * Origins allowed to read `/estate/*` from a browser.
 *
 * Previously `*`. Even for read-only projections of simulated data that is
 * broader than needed: it lets any page the operator visits enumerate the estate
 * and the tool inventory. The UI's own origin is the only one that needs access.
 */
const ALLOWED_ESTATE_ORIGINS = (
  process.env.OPS_ESTATE_ALLOWED_ORIGINS?.trim() || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Lab mode — off unless explicitly enabled.
 *
 * Adds two surfaces that exist purely so `npm run prove:gate` can run the
 * approval-gate conformance probes:
 *
 *   POST /mcp-unsafe     the unannotated twin (see tools/unsafeTwin.ts)
 *   POST /estate/reset   restore the seeded fixture between probes
 *
 * Both are absent from the default configuration. That matters: the twin is a
 * destructive tool that deliberately publishes no annotations, so it is exempt
 * from the harness approval gate by construction. It must never be reachable in
 * a normal run, and requiring an explicit opt-in is what guarantees that a
 * misconfiguration cannot quietly expose it.
 */
const LAB_MODE_REQUESTED = process.env.OPS_LAB_MODE?.trim() === '1';

/**
 * Lab mode requires a token. No exceptions, and this is why.
 *
 * `checkMcpAuth` returns "allowed" for every request when `OPS_MCP_TOKEN` is
 * unset — that is the documented default, and for `/mcp` it is a defensible
 * trade: loopback binding removes the network, and a tool reached through the
 * harness still meets the approval gate.
 *
 * Neither of those consolations applies to the lab surface. The twin is
 * *designed* to be exempt from the gate, so reaching it is unconditionally an
 * ungated production mutation, and `POST /estate/reset` destroys the audit log
 * that the conformance suite uses as its independent oracle. Leaving those open
 * to any local process — a browser tab, an npm postinstall, another dev tool —
 * would be a strictly worse version of the finding Qodo raised on PR #1, which
 * was precisely that a destructive tool was reachable without passing the gate.
 *
 * So the flag alone does not enable it. Requested-but-unauthenticated is refused
 * and logged, rather than quietly downgraded to the weaker posture.
 */
const LAB_MODE = LAB_MODE_REQUESTED && isLabTokenConfigured();

const app = express();
app.use(express.json({ limit: '4mb' }));

/**
 * `/estate/*` is a read-only projection for the UI, so it is CORS-enabled — but
 * only for known origins, and only for GET. `/mcp` is deliberately excluded: it
 * is reached server-to-server by the harness and never from a browser.
 */
app.use('/estate', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ESTATE_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

/**
 * Serve one MCP request against a freshly-built server.
 *
 * Parameterised by the builder so `/mcp` and `/mcp-unsafe` share one
 * authentication path, one error policy, and one lifecycle. Duplicating this for
 * the twin would risk the two endpoints drifting — and the probe result only
 * means anything if the *only* difference between them is the annotations.
 */
async function serveMcp(
  req: Request,
  res: Response,
  build: () => McpServer,
  label: string,
  /**
   * The authentication policy for this endpoint.
   *
   * Explicit per endpoint, because the two surfaces are guarded by different
   * secrets and a connector sends exactly one Authorization header. `/mcp-unsafe`
   * previously ran `checkLabAuth` and then reached here, which ran
   * `checkMcpAuth` against the *same* header — so whenever both tokens were set
   * and differed, the lab connector's header satisfied the first check and
   * failed the second, and every twin request 401'd. That is the documented
   * `provision --lab` setup on a secured deployment, so the conformance suite
   * would have been unable to run precisely where it matters most.
   */
  authenticate: (header: string | undefined) => string | null = checkMcpAuth,
): Promise<void> {
  // The harness enforces approval, not this server — so a caller who reaches
  // `/mcp` directly never encounters the gate at all. Authenticate before doing
  // anything else. See lib/auth.ts.
  const rejection = authenticate(req.headers.authorization);
  if (rejection) {
    logger.warn('mcp.unauthorized', { reason: rejection, ip: req.ip, endpoint: label });
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null,
    });
    return;
  }

  // Stateless: a fresh server and transport per request. These tools are plain
  // request/response, so there is no session state worth keeping. Estate state
  // lives in the process-wide store instead — see server.ts.
  try {
    const server = build();
    const transport = createStatelessTransport();

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await connectTransport(server, transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error('mcp.request_failed', {
      endpoint: label,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

app.post('/mcp', (req, res) => serveMcp(req, res, buildServer, '/mcp'));

if (LAB_MODE) {
  /**
   * The unannotated twin. Lab mode only.
   *
   * Register this in the harness as a second connector named
   * `sentinel-ops-unsafe`, then run `npm run prove:gate`. Everything about it is
   * identical to `rollback_deployment` except that it publishes no annotations,
   * which is what makes it exempt from `require_approval_for_tools`.
   */
  // Guarded by the lab token and *only* the lab token. Passing `checkLabAuth`
  // as the policy replaces the default rather than adding to it, so the single
  // Authorization header the connector sends is checked exactly once, against
  // the secret that actually protects this route.
  app.post('/mcp-unsafe', (req, res) =>
    serveMcp(req, res, buildUnsafeServer, '/mcp-unsafe', checkLabAuth),
  );

  /**
   * Restore the seeded estate. Lab mode only.
   *
   * The probes mutate production state on purpose — a bypass is only proven by
   * the mutation actually landing — so each one has to start from the same
   * fixture or the second probe measures the first probe's damage. Guarded by
   * the same flag as the twin rather than a separate one: both exist solely to
   * serve `prove:gate`, and two flags would let someone enable half of it.
   */
  app.post('/estate/reset', (req, res) => {
    const rejection = checkLabAuth(req.headers.authorization);
    if (rejection) {
      logger.warn('estate.reset_unauthorized', { reason: rejection, ip: req.ip });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    estate.reset();
    logger.info('estate.reset', { via: 'lab-mode' });
    res.json({ ok: true, reset_at: new Date().toISOString() });
  });

  /**
   * Swap the loaded scenario. Lab mode only.
   *
   * `npm run bench` walks all four cases through the same agent, and each one has
   * to start from its own clean fixture. Gated behind the same flag and token as
   * the twin rather than exposed generally: switching the estate mid-run would
   * make the audit log — which `prove:gate` uses as an independent oracle —
   * describe two different estates in one sequence.
   */
  app.post('/estate/scenario', (req, res) => {
    const rejection = checkLabAuth(req.headers.authorization);
    if (rejection) {
      logger.warn('estate.scenario_unauthorized', { reason: rejection, ip: req.ip });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requested = (req.body as { scenario_id?: unknown } | undefined)?.scenario_id;
    if (typeof requested !== 'string' || !requested) {
      res.status(400).json({
        error: 'scenario_id is required',
        available: SCENARIOS.map((s) => s.id),
      });
      return;
    }

    try {
      const scenario = estate.load(requested);
      logger.info('estate.scenario_loaded', { scenario: scenario.id, service: scenario.service });
      res.json({
        ok: true,
        scenario: {
          id: scenario.id,
          title: scenario.title,
          service: scenario.service,
          kind: scenario.kind,
        },
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
        available: SCENARIOS.map((s) => s.id),
      });
    }
  });
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, server: SERVER_NAME, version: SERVER_VERSION });
});

/** Tool inventory with risk classes — lets the UI render the safety model truthfully. */
app.get('/estate/tools', (_req, res) => {
  res.json({
    tools: allTools.map((t) => ({
      name: t.name,
      title: t.title,
      risk: t.risk,
      annotations: t.annotations,
    })),
  });
});

/** Independent record of every mutation, for cross-checking the agent's account. */
app.get('/estate/audit', (_req, res) => {
  res.json({ entries: estate.listAudit() });
});

app.get('/estate/state', (_req, res) => {
  const service = estate.service;
  const { id, title, kind, synopsis } = estate.scenario;
  res.json({
    service,
    // Which case the estate is currently loaded with. The UI shows this so an
    // operator looking at `payments-api` telemetry is never left wondering why
    // the checkout incident they expected is not there.
    scenario: { id, title, kind, synopsis },
    incidents: estate.listIncidents(),
    live_deployment: estate.liveDeployment(service) ?? null,
    health: estate.getHealth(service) ?? null,
    deployments: estate.listDeployments(service, 10),
    remediated_at: estate.remediatedAt(),
  });
});

/**
 * The agent's structured conclusions, and any independent audit of them.
 *
 * Separate from `/estate/state` because it answers a different question: state
 * is what the estate *is*, findings are what the agent *concluded about it*. The
 * UI renders them side by side precisely so the two can disagree visibly.
 */
app.get('/estate/findings', (_req, res) => {
  res.json({ findings: estate.listFindings(), latest: estate.latestFinding() });
});

/** Every scenario the bench can load, without the ground truth. */
app.get('/estate/scenarios', (_req, res) => {
  res.json({
    current: estate.scenario.id,
    scenarios: SCENARIOS.map((s) => ({
      id: s.id,
      title: s.title,
      service: s.service,
      kind: s.kind,
      synopsis: s.synopsis,
    })),
  });
});

const server = app.listen(PORT, HOST, () => {
  const gated = allTools.filter((t) => t.risk !== 'read');
  const posture = reportPosture(HOST);
  logger.info('mcp.listening', {
    url: `http://${HOST}:${PORT}/mcp`,
    tools: allTools.length,
    read_only: allTools.length - gated.length,
    approval_gated: gated.map((t) => t.name),
    loopback_only: posture.loopbackOnly,
    token_required: posture.tokenRequired,
    lab_mode: LAB_MODE,
  });

  // Lab mode exposes a destructive tool that is exempt from the approval gate by
  // construction. That is the point of it, and it is also exactly the sort of
  // thing that must never be running without the operator knowing, so it is
  // logged at `error` — the same level as the insecure-posture warning.
  if (LAB_MODE_REQUESTED && !LAB_MODE) {
    logger.error('mcp.lab_mode_refused', {
      detail:
        'OPS_LAB_MODE=1 but OPS_LAB_TOKEN is not set. Lab mode exposes an ' +
        'approval-exempt destructive tool and an audit-log reset, so it is refused ' +
        'rather than served unauthenticated. Set OPS_LAB_TOKEN, register it as ' +
        'Header auth on the sentinel-ops-unsafe connector (npm run provision -- --lab does this), and restart.',
    });
  }

  if (LAB_MODE) {
    logger.error('mcp.lab_mode_active', {
      unsafe_endpoint: `http://${HOST}:${PORT}/mcp-unsafe`,
      unsafe_server: UNSAFE_SERVER_NAME,
      unsafe_tool: UNSAFE_TWIN_TOOL,
      detail:
        'OPS_LAB_MODE=1. The unannotated twin and POST /estate/reset are reachable. ' +
        'Intended only for `npm run prove:gate`. Unset OPS_LAB_MODE for normal runs.',
    });
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('mcp.shutdown', { signal });
    server.close(() => process.exit(0));
  });
}
