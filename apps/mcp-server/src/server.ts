/** Builds a fresh `McpServer` with every registry tool attached. */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { allTools } from './tools/index.js';

export const SERVER_NAME = 'sentinel-ops';
export const SERVER_VERSION = '0.1.0';

/**
 * A new server instance per request.
 *
 * The HTTP transport is stateless, so there is no session to keep and a fresh
 * instance per request avoids any cross-request state. Estate state lives in the
 * process-wide `estate` store instead, which is what should persist — a rollback
 * must still be rolled back on the next call.
 */
export function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  for (const tool of allTools) {
    tool.register(server);
  }

  return server;
}
