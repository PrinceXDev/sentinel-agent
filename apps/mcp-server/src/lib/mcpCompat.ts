/**
 * The one place this codebase relaxes its own type strictness, and why.
 *
 * We compile with `exactOptionalPropertyTypes: true`. The MCP SDK is not authored
 * for that flag, and two of its declarations collide with it:
 *
 *  1. `Transport` declares `onclose?: () => void`, but
 *     `StreamableHTTPServerTransport` exposes an accessor typed
 *     `(() => void) | undefined`. Under exact-optional those are different types,
 *     so a transport instance is not assignable to the `Transport` parameter of
 *     `server.connect()` — despite the class declaring `implements Transport`.
 *
 *  2. `StreamableHTTPServerTransportOptions.sessionIdGenerator` is
 *     `?: () => string` — optional, but *not* `| undefined`. The SDK's own docs
 *     show `sessionIdGenerator: undefined` for stateless mode, which exact-optional
 *     rejects. Omitting the key entirely produces the same stateless behaviour and
 *     type-checks, so `createStatelessTransport` simply omits it.
 *
 * Rather than dropping the flag for the whole project, or sprinkling `as any` at
 * call sites, both accommodations live here behind named functions. If a future
 * SDK release fixes its optionality, this file gets deleted and nothing else
 * changes.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * A stateless streamable-HTTP transport: no session id, no session validation,
 * no per-connection state. Correct for plain request/response tools.
 */
export function createStatelessTransport(): StreamableHTTPServerTransport {
  // `sessionIdGenerator` is deliberately omitted rather than set to `undefined`.
  // See note 2 above.
  return new StreamableHTTPServerTransport();
}

/**
 * Connect a server to a transport across the optionality mismatch in note 1.
 *
 * The cast is sound: `StreamableHTTPServerTransport implements Transport`, and the
 * only difference is whether `undefined` is spelled in the accessor type or
 * implied by the optional marker.
 */
export async function connectTransport(
  server: McpServer,
  transport: StreamableHTTPServerTransport,
): Promise<void> {
  await server.connect(transport as unknown as Transport);
}
