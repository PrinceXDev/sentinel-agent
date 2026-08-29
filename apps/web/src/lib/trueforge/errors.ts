/**
 * Turning SDK errors into something a human can act on.
 *
 * `TrueForgeError.message` is transport-shaped: it reads
 * `Status code: 502 Body: {"error":"harness_unreachable","message":"Could not reach…"}`.
 * The useful sentence is in there, wrapped in framing that tells the reader
 * nothing they can use.
 *
 * The proxy route already produces good messages — "Could not reach the TrueForge
 * harness at http://localhost:8790. Is it running?" — and the harness produces
 * its own for 4xx cases. This module digs those out, and falls back to naming the
 * status code's likely cause when there is no message to find.
 */

import { TrueForgeError, TrueForgeTimeoutError } from '@truefoundry/trueforge-sdk';

/** Status codes worth explaining in the harness's own terms. */
const STATUS_HINTS: Record<number, string> = {
  403: 'The harness refused the request. Sessions are readable only by the identity that created them.',
  404: 'The harness could not find that session or turn. It may have been deleted, or the harness restarted.',
  412: 'That turn is no longer live. Its event buffer has expired, so only the persisted history remains.',
  422: 'The harness rejected the request. Usually a missing model, MCP server, or skill — or an approval that was already resolved.',
  428: 'Configuration is incomplete. Check SENTINEL_MODEL is set to a model configured in the harness.',
  502: 'Could not reach the harness. Check it is running on the address in TRUEFORGE_BASE_URL.',
};

const TIMEOUT_MESSAGE =
  'The harness did not respond in time. A long investigation can outlive the request timeout — the turn may still be running, and reloading will re-attach to it.';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

/**
 * The `message` field from an error body, whether it arrived parsed or as a JSON
 * string. Both the proxy route and the harness return `{ error, message }`.
 */
const messageFromBody = (body: unknown): string | null => {
  if (isRecord(body) && typeof body.message === 'string' && body.message.trim()) {
    return body.message;
  }

  if (typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (isRecord(parsed) && typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      // Not JSON after all. The status hint below is a better answer than the
      // raw string, which would just be the transport framing again.
    }
  }

  return null;
};

/** What a status code means here, when the body carried nothing useful. */
const messageFromStatus = (statusCode: number | undefined): string | null => {
  if (statusCode === undefined) return null;
  return STATUS_HINTS[statusCode] ?? `The harness returned ${statusCode}.`;
};

/**
 * Pull the most specific message available out of a thrown value.
 *
 * Order matters: the server's own `message` beats a generic status hint, which in
 * turn beats the SDK's transport-shaped string.
 */
export const describeError = (error: unknown): string => {
  if (error instanceof TrueForgeTimeoutError) {
    return TIMEOUT_MESSAGE;
  }

  if (error instanceof TrueForgeError) {
    return (
      messageFromBody(error.body) ??
      messageFromStatus(error.statusCode) ??
      'The harness returned an error with no detail.'
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Something failed and produced no message. Check the browser console and the harness logs.';
};

/** Marker the proxy puts on a refusal, so it can be told from a harness 403. */
const PROXY_FORBIDDEN = 'forbidden';

/**
 * Whether this failure was the proxy refusing a state-changing call for want of
 * a valid operator token.
 *
 * Distinguished from a harness 403 (which means "not your session") because the
 * two need different responses from the UI: one is fixed by entering a token, the
 * other is not fixable at all. Matching on the `error` discriminator rather than
 * the status code is what keeps them apart.
 */
export const isOperatorTokenRefusal = (error: unknown): boolean => {
  if (!(error instanceof TrueForgeError) || error.statusCode !== 403) return false;

  const body = error.body;
  if (isRecord(body)) return body.error === PROXY_FORBIDDEN;

  if (typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(body) as unknown;
      return isRecord(parsed) && parsed.error === PROXY_FORBIDDEN;
    } catch {
      return false;
    }
  }

  return false;
};
