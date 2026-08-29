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

const get = async <T>(
  path: string,
  guard: (value: unknown) => value is T,
): Promise<EstateResult<T>> => {
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
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Every element satisfies `check`. Empty arrays pass, which is correct here. */
const isArrayOf = <T>(value: unknown, check: (v: unknown) => v is T): value is T[] => {
  return Array.isArray(value) && value.every(check);
};

const isNote = (v: unknown): v is EstateIncident['notes'][number] => {
  return isRecord(v) && isStr(v.at) && isStr(v.author) && isStr(v.body);
};

const isIncident = (v: unknown): v is EstateIncident => {
  return (
    isRecord(v) &&
    isStr(v.id) &&
    isStr(v.title) &&
    isStr(v.service) &&
    isStr(v.severity) &&
    isStr(v.status) &&
    isStr(v.summary) &&
    isStr(v.detected_at) &&
    isStr(v.detected_by) &&
    isArrayOf(v.notes, isNote)
  );
};

const isDeployment = (v: unknown): v is EstateDeployment => {
  return (
    isRecord(v) &&
    isStr(v.id) &&
    isStr(v.service) &&
    isStr(v.version) &&
    isStr(v.commit_sha) &&
    isStr(v.author) &&
    isStr(v.message) &&
    isStr(v.deployed_at) &&
    isStr(v.status) &&
    isArrayOf(v.changed_files, isStr)
  );
};

const isHealthCheck = (v: unknown): v is EstateHealth['checks'][number] => {
  return isRecord(v) && isStr(v.name) && typeof v.ok === 'boolean' && isStr(v.detail);
};

const isHealth = (v: unknown): v is EstateHealth => {
  return (
    isRecord(v) &&
    isStr(v.service) &&
    isStr(v.status) &&
    isStr(v.live_deployment_id) &&
    isNum(v.replicas_ready) &&
    isNum(v.replicas_desired) &&
    isArrayOf(v.checks, isHealthCheck)
  );
};

/**
 * Validate an `/estate/state` payload down to its leaves.
 *
 * The shallow version — `service` is a string and `incidents` is an array — was
 * not a guard so much as a formality. `incidents: [null]` passed it, and the
 * incident header then read `.title` off `null` and took the view down mid-run.
 * `live_deployment` and `health` were never checked at all despite being rendered
 * directly.
 *
 * This is the only defence against server/client drift: the types here are
 * deliberately duplicated from the MCP server rather than shared (see the module
 * header), so a shape change on the server does not fail this app's typecheck.
 * Whatever this function does not check, nothing does.
 *
 * `null` is accepted for `live_deployment` and `health` because the server
 * genuinely sends null for an unknown service — that is valid, not malformed.
 */
export const isEstateState = (value: unknown): value is EstateState => {
  return (
    isRecord(value) &&
    isStr(value.service) &&
    isArrayOf(value.incidents, isIncident) &&
    (value.live_deployment === null || isDeployment(value.live_deployment)) &&
    (value.health === null || isHealth(value.health)) &&
    isArrayOf(value.deployments, isDeployment)
  );
};

const isAuditPayload = (value: unknown): value is { entries: AuditEntry[] } =>
  isRecord(value) && Array.isArray(value.entries);

const isToolsPayload = (value: unknown): value is { tools: EstateToolInfo[] } =>
  isRecord(value) && Array.isArray(value.tools);

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
export const firstFailure = (results: EstateResult<unknown>[]): EstateError | null => {
  for (const result of results) {
    if (!result.ok) return result.error;
  }
  return null;
};
