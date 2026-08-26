/** Domain model for the simulated production estate sentinel-agent investigates. */

export type Severity = 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4';

export type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved';

export type DeploymentStatus = 'live' | 'superseded' | 'rolled_back';

export type ServiceStatus = 'healthy' | 'degraded' | 'down';

export interface Incident {
  readonly id: string;
  readonly title: string;
  readonly service: string;
  readonly severity: Severity;
  status: IncidentStatus;
  readonly summary: string;
  readonly detected_at: string;
  readonly detected_by: string;
  /** Free-text notes appended by tools. Ordered oldest first. */
  notes: IncidentNote[];
}

export interface IncidentNote {
  readonly at: string;
  readonly author: string;
  readonly body: string;
}

export interface Deployment {
  readonly id: string;
  readonly service: string;
  readonly version: string;
  readonly commit_sha: string;
  readonly author: string;
  readonly message: string;
  readonly deployed_at: string;
  status: DeploymentStatus;
  readonly changed_files: readonly string[];
  /** Unified diff for the change. Present for every deployment in the fixture. */
  readonly diff: string;
}

/** One minute-resolution sample of a service's golden signals. */
export interface MetricSample {
  readonly ts: string;
  /** 95th-percentile request latency, milliseconds. */
  readonly p95_latency_ms: number;
  /** 50th-percentile request latency, milliseconds. */
  readonly p50_latency_ms: number;
  /** Fraction of requests returning 5xx, 0..1. */
  readonly error_rate: number;
  /** Requests per second. */
  readonly rps: number;
}

export interface ServiceHealth {
  readonly service: string;
  readonly status: ServiceStatus;
  readonly live_deployment_id: string;
  readonly replicas_ready: number;
  readonly replicas_desired: number;
  readonly checks: readonly HealthCheck[];
}

export interface HealthCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** Append-only record of every state change a tool made. Powers the audit trail. */
export interface AuditEntry {
  readonly at: string;
  readonly tool: string;
  readonly actor: string;
  readonly summary: string;
  readonly details: Readonly<Record<string, unknown>>;
}
