/**
 * Server-side proxy to the TrueForge harness.
 *
 * The browser talks to `/tf/*` on this origin; this handler forwards to
 * `TRUEFORGE_BASE_URL`. Three reasons it exists rather than the browser calling
 * the harness directly:
 *
 *  1. **The token never reaches the browser.** `TRUEFORGE_TOKEN` is read from
 *     server env and attached here. A client-side SDK would have to ship it in
 *     the bundle, where anyone can read it.
 *  2. **No CORS.** Same-origin from the browser's point of view, so the harness
 *     needs no CORS configuration at all.
 *  3. **Streaming stays streaming.** `upstream.body` is passed straight through
 *     as a `ReadableStream`, never buffered — turn events would otherwise all
 *     arrive at once when the turn ended, which would defeat the entire point of
 *     a live view.
 *
 * `force-dynamic` and `revalidate = 0` matter here: any caching of an SSE
 * response or a session mutation would be actively wrong.
 */

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Node runtime, not edge: the SDK and this handler both rely on undici's
// duplex request streaming, and there is no edge-specific benefit here.
export const runtime = 'nodejs';

const UPSTREAM = process.env.TRUEFORGE_BASE_URL ?? 'http://localhost:8790';
const TOKEN = process.env.TRUEFORGE_TOKEN ?? '';

/**
 * Request headers worth forwarding. An allowlist rather than a blocklist —
 * forwarding everything would leak cookies and this origin's `host` upstream.
 */
const FORWARD_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language'];

/**
 * Response headers worth returning. `content-type` carries `text/event-stream`,
 * which is what makes the browser treat the body as a stream.
 */
const FORWARD_RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'];

function buildUpstreamUrl(req: NextRequest, segments: string[]): string {
  // Rebuild rather than string-concatenating the raw path, so a crafted segment
  // cannot escape the upstream origin.
  const path = segments.map(encodeURIComponent).join('/');
  const url = new URL(`${UPSTREAM.replace(/\/$/, '')}/${path}`);
  url.search = req.nextUrl.search;
  return url.toString();
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (TOKEN) headers.set('authorization', `Bearer ${TOKEN}`);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(buildUpstreamUrl(req, path), {
      method: req.method,
      headers,
      ...(hasBody ? { body: req.body, duplex: 'half' } : {}),
      // Never let Next cache a harness call.
      cache: 'no-store',
      redirect: 'manual',
    } as RequestInit & { duplex?: 'half' });
  } catch (error) {
    // The harness being down is the single most likely failure in local
    // development, so say so precisely instead of surfacing a generic 500.
    return Response.json(
      {
        error: 'harness_unreachable',
        message: `Could not reach the TrueForge harness at ${UPSTREAM}. Is it running?`,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // Streaming responses must not sit in an intermediary buffer. `no-transform`
  // and the nginx-specific hint below are cheap insurance for deployments that
  // put a reverse proxy in front of this.
  if (upstream.headers.get('content-type')?.includes('text/event-stream')) {
    responseHeaders.set('cache-control', 'no-cache, no-transform');
    responseHeaders.set('connection', 'keep-alive');
    responseHeaders.set('x-accel-buffering', 'no');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
  proxy as HEAD,
};
