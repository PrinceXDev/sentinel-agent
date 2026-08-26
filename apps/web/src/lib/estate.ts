/**
 * Typed client for the estate API.
 *
 * These types mirror `apps/mcp-server/src/domain/types.ts`. They are duplicated
 * rather than shared through a workspace package because the two apps are
 * deliberately decoupled: the MCP server is the estate's owner and the web app is
 * one consumer of its HTTP surface, exactly as it would be if the estate were a
 * real observability vendor. A shared type package would imply a coupling that
 * does not exist, and would break the moment the estate is swapped for a real
 * system.
 *
 * The tradeoff is that a change to the server's shape will not fail this app's
 * typecheck. `isEstateState` guards against that at runtime instead.
 */

export interface EstateIncident {
  id: string;
  title: string;
  service: string;
  severity: string;
  status: string;
  summary: string;
  detected_at: string;
  detected_by: string;
  notes: { at: string; author: string; body: string }[];
}

export interface EstateDeployment {
  id: string;
  service: string;
  version: string;
  commit_sha: string;
  author: string;
  message: string;
  deployed_at: string;
  status: string;
  changed_files: string[];
}

export interface EstateHealth {
  service: string;
  status: string;
  live_deployment_id: string;
  replicas_ready: number;
  replicas_desired: number;
  checks: { name: string; ok: boolean; detail: string }[];
}

export interface EstateState {
  service: string;
  incidents: EstateIncident[];
  live_deployment: EstateDeployment | null;
  health: EstateHealth | null;
  deployments: EstateDeployment[];
}

export interface AuditEntry {
  at: string;
  tool: string;
  actor: string;
  summary: string;
  details: Record<string, unknown>;
}

export interface EstateToolInfo {
  name: string;
  title: string;
  risk: 'read' | 'write' | 'destructive';
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

/** Returned instead of throwing, so a down ops server degrades the view rather than breaking it. */
export interface EstateError {
  error: string;
  message: string;
}

export type EstateResult<T> = { ok: true; data: T } | { ok: false; error: EstateError };

async function get<T>(
  path: string,
  guard: (value: unknown) => value is T,
): Promise<EstateResult<T>> {
  try {
    const response = await fetch(`/estate/${path}`, { cache: 'no-store' });
    const body = (await response.json()) as unknown;

    if (!response.ok) {
      const err = body as Partial<EstateError>;
      return {
        ok: false,
        error: {
          error: err.error ?? 'request_failed',
          message: err.message ?? `Estate request failed with ${response.status}.`,
        },
      };
    }

    if (!guard(body)) {
      // The server changed shape. Say so plainly rather than rendering undefined
      // into the incident header, which is how a stale field becomes a wrong number.
      return {
        ok: false,
        error: {
          error: 'unexpected_shape',
          message: `The ops server returned a payload this UI does not recognise for /estate/${path}.`,
        },
      };
    }

    return { ok: true, data: body };
  } catch (error) {
    return {
      ok: false,
      error: {
        error: 'network_error',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isEstateState(value: unknown): value is EstateState {
  return isRecord(value) && typeof value.service === 'string' && Array.isArray(value.incidents);
}

function isAuditPayload(value: unknown): value is { entries: AuditEntry[] } {
  return isRecord(value) && Array.isArray(value.entries);
}

function isToolsPayload(value: unknown): value is { tools: EstateToolInfo[] } {
  return isRecord(value) && Array.isArray(value.tools);
}

export const estate = {
  state: () => get('state', isEstateState),
  audit: () => get('audit', isAuditPayload),
  tools: () => get('tools', isToolsPayload),
};

/**
 * The first failure among several estate reads, or null if all succeeded.
 *
 * These requests share one upstream, so when the ops server is down every one of
 * them fails with the same message. Reporting the first is informative; reporting
 * all of them is the same sentence repeated.
 */
export function firstFailure(results: EstateResult<unknown>[]): EstateError | null {
  for (const result of results) {
    if (!result.ok) return result.error;
  }
  return null;
}
