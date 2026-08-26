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
import { logger } from './lib/logger.js';
import { connectTransport, createStatelessTransport } from './lib/mcpCompat.js';
import { buildServer, SERVER_NAME, SERVER_VERSION } from './server.js';
import { allTools } from './tools/index.js';

const PORT = Number(process.env.OPS_MCP_PORT ?? 8940);

const app = express();
app.use(express.json({ limit: '4mb' }));

/**
 * The UI runs on a different origin in development, and these routes are
 * read-only projections of simulated data, so a permissive CORS policy is safe
 * here. `/mcp` is deliberately excluded — it is reached server-to-server by the
 * harness and never from a browser.
 */
app.use('/estate', (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

app.post('/mcp', async (req: Request, res: Response) => {
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

const server = app.listen(PORT, () => {
  const gated = allTools.filter((t) => t.risk !== 'read');
  logger.info('mcp.listening', {
    url: `http://localhost:${PORT}/mcp`,
    tools: allTools.length,
    read_only: allTools.length - gated.length,
    approval_gated: gated.map((t) => t.name),
  });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('mcp.shutdown', { signal });
    server.close(() => process.exit(0));
  });
}
