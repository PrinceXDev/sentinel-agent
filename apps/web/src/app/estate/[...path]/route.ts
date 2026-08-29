/**
 * Read-only proxy to the ops MCP server's estate API.
 *
 * The MCP server exposes two surfaces: `/mcp` for the agent, and `/estate/*` as
 * a plain read-only view of the simulated production estate. This route forwards
 * the second so the browser never needs to know the MCP server's address or rely
 * on its CORS headers.
 *
 * Why the UI reads the estate directly at all: it gives a record of what actually
 * changed that is **independent of the agent's account of what it did**. The
 * agent says it rolled back `dpl-4c21`; `/estate/audit` says the estate recorded
 * a rollback of `dpl-4c21`. Two sources that can be compared are worth more than
 * one that has to be trusted.
 *
 * GET only. Nothing here should ever mutate the estate — the agent's approval-
 * gated tools are the only path to that, and routing a mutation through the UI
 * would be a way around the gate.
 */

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const UPSTREAM = process.env.OPS_MCP_BASE_URL ?? 'http://localhost:8940';

export const GET = async (
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> => {
  const { path } = await ctx.params;
  const safePath = path.map(encodeURIComponent).join('/');
  const url = new URL(`${UPSTREAM.replace(/\/$/, '')}/estate/${safePath}`);
  url.search = req.nextUrl.search;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (error) {
    return Response.json(
      {
        error: 'ops_server_unreachable',
        message: `Could not reach the ops MCP server at ${UPSTREAM}. Is it running? (npm run dev:mcp)`,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get('content-type');
  return new Response(upstream.body, {
    status: upstream.status,
    headers: contentType ? { 'content-type': contentType } : {},
  });
};
