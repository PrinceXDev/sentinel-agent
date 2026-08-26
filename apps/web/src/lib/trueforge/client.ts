/**
 * TrueForge SDK client, pointed at this app's own proxy.
 *
 * `baseUrl` is `<origin>/tf`, not the harness directly. The proxy route attaches
 * the token server-side, so nothing secret is constructed here and the browser
 * never learns the harness's real address. The SDK appends `/api/v1/...`, which
 * the proxy forwards verbatim.
 *
 * An absolute origin is used rather than the relative `/tf`, because the SDK
 * constructs `URL` objects and a relative base has no defined origin to resolve
 * against.
 */

import { TrueForge } from '@truefoundry/trueforge-sdk';

/** Path prefix served by `app/tf/[...path]/route.ts`. */
export const PROXY_PREFIX = '/tf';

/** Long enough for a full investigation; a streaming turn holds the connection open. */
const TIMEOUT_SECONDS = 600;

export function createClient(): TrueForge {
  if (typeof window === 'undefined') {
    // The client is only ever constructed in browser components. Failing loudly
    // beats silently building a client with a wrong base URL during SSR.
    throw new Error('createClient() must be called in the browser.');
  }
  return new TrueForge({
    baseUrl: `${window.location.origin}${PROXY_PREFIX}`,
    timeoutInSeconds: TIMEOUT_SECONDS,
  });
}

/** localStorage key holding the reconnect triple. */
const HANDLE_KEY = 'sentinel-agent:run-handle';

export interface StoredHandle {
  sessionId: string;
  turnId: string;
  lastSequenceNumber: number;
}

/**
 * Persist the reconnect triple.
 *
 * `{ sessionId, turnId, lastSequenceNumber }` is the entire state needed to
 * re-attach to a running turn after a reload — there is no resume endpoint, so
 * this triple plus `getTurn` is the whole mechanism.
 */
export function saveHandle(handle: StoredHandle): void {
  try {
    window.localStorage.setItem(HANDLE_KEY, JSON.stringify(handle));
  } catch {
    // Private browsing or a full quota. Losing resume across reloads is a
    // degraded experience, not a broken one, so this is not worth surfacing.
  }
}

export function loadHandle(): StoredHandle | null {
  try {
    const raw = window.localStorage.getItem(HANDLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredHandle>;
    if (
      typeof parsed.sessionId === 'string' &&
      typeof parsed.turnId === 'string' &&
      typeof parsed.lastSequenceNumber === 'number'
    ) {
      return {
        sessionId: parsed.sessionId,
        turnId: parsed.turnId,
        lastSequenceNumber: parsed.lastSequenceNumber,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearHandle(): void {
  try {
    window.localStorage.removeItem(HANDLE_KEY);
  } catch {
    // Nothing actionable.
  }
}
