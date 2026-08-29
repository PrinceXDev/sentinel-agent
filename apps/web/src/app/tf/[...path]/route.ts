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
 *
 * Reads are free of the operator token **only from the expected local
 * origin** — see `isLocalHost`. `scripts/wsl-tunnel.sh` exposes this whole
 * route over a public URL with a different `Host`, and a caller that arrives
 * that way is held to the same bar as a mutation.
 */

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Node runtime, not edge: the SDK and this handler both rely on undici's
// duplex request streaming, and there is no edge-specific benefit here.
export const runtime = 'nodejs';

const UPSTREAM = process.env.TRUEFORGE_BASE_URL ?? 'http://localhost:8790';
const TOKEN = process.env.TRUEFORGE_TOKEN ?? '';

/**
 * Secret required on state-changing requests. Read server-side only and never
 * rendered into the page — see `lib/operatorToken.ts` for the reasoning.
 *
 * Unset means mutations are refused outright rather than allowed. An unset
 * credential must never mean "no check": that is how a guard becomes a no-op in
 * exactly the deployment that most needs it.
 */
const OPERATOR_TOKEN = process.env.SENTINEL_UI_TOKEN?.trim() ?? '';

const OPERATOR_TOKEN_HEADER = 'x-sentinel-operator';

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

/**
 * Methods that can change harness state — including resolving an approval, which
 * is a POST that creates a turn.
 */
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Hostnames this proxy expects to be reached at during local development.
 *
 * "Read paths are ungated" (see docs/architecture.md § Trust model) is sound
 * reasoning for a tool reachable only from this machine — but `wsl-tunnel.sh`
 * exposes this entire origin over an anonymous public URL, and that origin
 * arrives with a *different* `Host` header (`<name>.trycloudflare.com`), not
 * one of these. Anyone holding that URL could `GET` harness session and turn
 * data — with `TRUEFORGE_TOKEN` attached server-side — without ever entering an
 * operator token, since only mutations were checked. This is what closes it: the
 * read-is-free trade only applies to genuinely local traffic.
 */
const LOCAL_HOSTS = new Set(['localhost:3000', '127.0.0.1:3000']);

/** True when this request's `Host` matches an expected local address. */
const isLocalHost = (req: NextRequest): boolean => {
  return LOCAL_HOSTS.has(req.headers.get('host') ?? '');
};

/**
 * Reject requests this proxy should not carry the harness token for.
 *
 * ## The exposure being closed
 *
 * This route attaches a server-held bearer token to whatever it forwards. It
 * therefore grants harness privileges — including **approving a production
 * rollback** — to any caller that can reach it. Two ways that gets abused:
 *
 *  1. **Cross-site request forgery.** A page the operator visits in another tab
 *     can `fetch('http://localhost:3000/tf/api/v1/sessions/.../turns', …)` and
 *     approve a pending action. No credentials of its own are needed, because the
 *     token is added on this side.
 *  2. **Off-box callers.** `next dev` binds all interfaces by default, so anything
 *     on the LAN can do the same. The `dev` script pins `-H 127.0.0.1`; this
 *     check is the belt to that braces.
 *
 * `Sec-Fetch-Site` is the reliable signal — browsers set it and script cannot
 * forge it. Requests carrying `cross-site` or `same-site` are refused for
 * mutations. Non-browser callers (curl, the SDK from a server) send no
 * `Sec-Fetch-Site` at all and are allowed, which is deliberate: this is a
 * same-origin browser guard, not an authentication system.
 *
 *  3. **Local processes.** `Sec-Fetch-Site` is a browser signal. A local `curl`
 *     sends none at all, so the origin check alone left reachability sufficient
 *     for authority — anything able to POST to `:3000` could approve a rollback.
 *     The operator token closes that: mutations require a secret the server never
 *     sends to the browser.
 *
 * ## What this deliberately does not do
 *
 * It does not model *which human* is approving. A hostile process running as the
 * same OS user can read `.env` and obtain the token — unavoidable, since the
 * credential must live somewhere that user can read. What changes is that
 * reachability is no longer authority.
 *
 * Genuine multi-operator authorisation needs an identity provider in front of the
 * UI and a rule about which humans may approve which actions. See
 * docs/architecture.md § Trust model.
 */
const denyReason = (req: NextRequest): string | null => {
  const mutating = MUTATING_METHODS.has(req.method);
  const local = isLocalHost(req);

  // Reads from the expected local origin stay free — that trade only holds for
  // genuinely local traffic. Reads arriving any other way (through the tunnel,
  // or anything else fronting this origin) are held to the same bar as a
  // mutation: the token is required, full stop.
  if (!mutating && local) return null;

  // Origin check first: it is the cheaper signal and catches browser CSRF.
  // Scoped to mutations — a cross-site *read* isn't the CSRF concern this
  // guards against, and the token check below already covers the case that
  // actually matters (an off-host reader with no token at all).
  if (mutating) {
    const site = req.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') {
      return `Cross-origin ${req.method} to the harness proxy is refused (Sec-Fetch-Site: ${site}). Approvals may only be submitted from the sentinel-agent UI itself.`;
    }
  }

  // Fail closed when unconfigured. Treating an unset token as "no check needed"
  // would disable the guard precisely where it was never set up.
  if (!OPERATOR_TOKEN) {
    return `${req.method} refused: SENTINEL_UI_TOKEN is not configured on the server, so ${mutating ? 'state-changing calls' : 'this call, reached off the expected local origin,'} cannot be authorised. Set it in .env and enter the same value in the UI.`;
  }

  const presented = req.headers.get(OPERATOR_TOKEN_HEADER)?.trim() ?? '';
  if (!presented) {
    return `${req.method} refused: missing operator token. ${mutating ? 'State-changing calls' : 'Calls reached off the expected local origin'} must present ${OPERATOR_TOKEN_HEADER}.`;
  }
  if (!constantTimeEquals(presented, OPERATOR_TOKEN)) {
    return `${req.method} refused: operator token does not match.`;
  }

  return null;
};

/**
 * Compare without leaking length or content through timing.
 *
 * `timingSafeEqual` throws on differing lengths, which would itself be a signal,
 * so length is checked first and reported as a plain mismatch.
 */
const constantTimeEquals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

const buildUpstreamUrl = (req: NextRequest, segments: string[]): string => {
  // Rebuild rather than string-concatenating the raw path, so a crafted segment
  // cannot escape the upstream origin.
  const path = segments.map(encodeURIComponent).join('/');
  const url = new URL(`${UPSTREAM.replace(/\/$/, '')}/${path}`);
  url.search = req.nextUrl.search;
  return url.toString();
};

const proxy = async (
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> => {
  const { path } = await ctx.params;

  const denial = denyReason(req);
  if (denial) {
    return Response.json({ error: 'forbidden', message: denial }, { status: 403 });
  }

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
};

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
  proxy as HEAD,
};
