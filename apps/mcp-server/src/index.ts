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

import express, { type Request, type Response } from 'express';
import { SERVICE } from './domain/fixtures.js';
import { estate } from './domain/store.js';
import { checkMcpAuth, reportPosture } from './lib/auth.js';
import { logger } from './lib/logger.js';
import { connectTransport, createStatelessTransport } from './lib/mcpCompat.js';
import { buildServer, SERVER_NAME, SERVER_VERSION } from './server.js';
import { allTools } from './tools/index.js';

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

app.post('/mcp', async (req: Request, res: Response) => {
  // The harness enforces approval, not this server — so a caller who reaches
  // `/mcp` directly never encounters the gate at all. Authenticate before doing
  // anything else. See lib/auth.ts.
  const rejection = checkMcpAuth(req.headers.authorization);
  if (rejection) {
    logger.warn('mcp.unauthorized', { reason: rejection, ip: req.ip });
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
    const server = buildServer();
    const transport = createStatelessTransport();

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await connectTransport(server, transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error('mcp.request_failed', {
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
});

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
  res.json({
    service: SERVICE,
    incidents: estate.listIncidents(),
    live_deployment: estate.liveDeployment(SERVICE) ?? null,
    health: estate.getHealth(SERVICE) ?? null,
    deployments: estate.listDeployments(SERVICE, 10),
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
  });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('mcp.shutdown', { signal });
    server.close(() => process.exit(0));
  });
}
