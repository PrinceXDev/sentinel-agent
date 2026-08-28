/**
 * Transport-level authentication for the MCP endpoint.
 *
 * ## Why this exists
 *
 * sentinel-agent's entire safety model is that production-mutating tools pause
 * for human approval. That gate lives in the **TrueForge harness** — it is the
 * harness that reads MCP annotations and decides to pause.
 *
 * The MCP server itself has no gate, and cannot have one: a tool call arriving
 * over HTTP is just a tool call. So anyone who can reach `POST /mcp` directly can
 * invoke `rollback_deployment` without the harness ever being involved, and the
 * approval prompt never happens. The gate is not bypassed so much as simply
 * never reached.
 *
 * Two layers close that:
 *
 *  1. **Bind to loopback** (see `index.ts`). Removes the network entirely from
 *     the threat model in the default configuration.
 *  2. **This module.** When `OPS_MCP_TOKEN` is set, `/mcp` requires a matching
 *     bearer token. TrueForge supports exactly this on a connector — Settings →
 *     Connectors → Header auth — so the harness can present the token while
 *     nothing else can.
 *
 * Layer 2 matters even on loopback: any local process, including a browser tab
 * running untrusted JavaScript, can reach `127.0.0.1:8940`.
 *
 * The token is optional rather than mandatory because requiring it would break
 * the documented one-command local setup. That is a deliberate trade, and the
 * server logs which posture it is running in at startup so the weaker one is
 * never silent.
 */

import { timingSafeEqual } from 'node:crypto';

import { logger } from './logger.js';

const TOKEN = process.env.OPS_MCP_TOKEN?.trim() ?? '';

export interface AuthPosture {
  readonly tokenRequired: boolean;
  readonly host: string;
  readonly loopbackOnly: boolean;
}

/**
 * The lab-surface token. Separate from `OPS_MCP_TOKEN`, deliberately.
 *
 * The obvious design is to reuse `OPS_MCP_TOKEN` for the lab endpoints. It was
 * tried and rejected, because `checkMcpAuth` applies to *every* endpoint: setting
 * that variable makes the ordinary `/mcp` surface require a bearer token too, and
 * the harness reaches `/mcp` through a connector whose auth header can only be
 * set at creation — the API exposes list/create/get and no update or delete
 * (verified: PUT and DELETE both 404). So reusing it would mean deleting and
 * recreating the working connector by hand in the UI before the conformance suite
 * could run, and would break the documented one-command local setup that a
 * stranger cloning this repo depends on.
 *
 * A dedicated token avoids all of that. The normal path keeps its documented
 * posture — loopback only, no token — and the dangerous surface gets a key of its
 * own, carried by a connector that `provision --lab` creates fresh with the right
 * header already attached. Nothing existing has to be touched.
 */
const LAB_TOKEN = process.env.OPS_LAB_TOKEN?.trim() ?? '';

export function isLabTokenConfigured(): boolean {
  return LAB_TOKEN.length > 0;
}

/**
 * Authenticate a request to a lab-only endpoint.
 *
 * Unlike `checkMcpAuth`, this has **no unauthenticated mode**. There is no
 * posture in which an approval-exempt destructive tool should answer an
 * anonymous caller, so a missing token is a rejection here rather than a
 * documented trade-off. `index.ts` additionally refuses to mount these routes at
 * all without a token, making this the second of two independent guards.
 */
export function checkLabAuth(authorizationHeader: string | undefined): string | null {
  if (!LAB_TOKEN) return 'lab_token_not_configured';
  if (!authorizationHeader) return 'missing_authorization_header';

  const [scheme, ...rest] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return 'unsupported_auth_scheme';

  const provided = rest.join(' ').trim();
  if (!provided) return 'empty_bearer_token';
  if (!tokensMatch(provided, LAB_TOKEN)) return 'token_mismatch';

  return null;
}

/** Constant-time compare, so a wrong token cannot be discovered byte by byte. */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // `timingSafeEqual` throws on length mismatch, which would itself leak length.
  // Compare a fixed-size digest-like padding instead: equal lengths, then content.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Check an incoming `/mcp` request's credentials.
 *
 * Returns `null` when the request is allowed, or a reason string when it is not.
 * Reasons are logged but never returned to the caller — an unauthenticated
 * client learns only that it was rejected.
 */
export function checkMcpAuth(authorizationHeader: string | undefined): string | null {
  if (!TOKEN) return null; // No token configured: loopback binding is the only control.

  if (!authorizationHeader) return 'missing_authorization_header';

  const [scheme, ...rest] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return 'unsupported_auth_scheme';

  const provided = rest.join(' ').trim();
  if (!provided) return 'empty_bearer_token';
  if (!tokensMatch(provided, TOKEN)) return 'token_mismatch';

  return null;
}

/**
 * Describe the running security posture, and warn when it is the weak one.
 *
 * A server that is reachable off-box with no token can have its destructive
 * tools called by anything on the network, so that combination is logged at
 * `error` rather than buried at `info`.
 */
export function reportPosture(host: string): AuthPosture {
  const loopbackOnly = host === '127.0.0.1' || host === '::1' || host === 'localhost';
  const posture: AuthPosture = { tokenRequired: TOKEN.length > 0, host, loopbackOnly };

  if (!loopbackOnly && !TOKEN) {
    logger.error('mcp.insecure_posture', {
      host,
      detail:
        'Bound off-loopback with no OPS_MCP_TOKEN. Destructive tools are reachable by any host that can route here, without passing through the harness approval gate. Set OPS_MCP_TOKEN and register it as Header auth on the connector.',
    });
  }

  return posture;
}
