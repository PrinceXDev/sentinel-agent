/**
 * Mutable estate state.
 *
 * The store is the only place tools may mutate anything, and every mutation is
 * appended to an audit log. That gives the UI a second, independent record of
 * what actually changed — separate from TrueForge's event stream — so "the agent
 * said it rolled back" and "the estate was rolled back" can be verified against
 * each other rather than assumed to agree.
 *
 * Deliberately in-memory: this is a simulated estate, and a restart returning it
 * to a clean pre-incident state is a feature when rehearsing a demo.
 */

import {
  buildDeployments,
  buildHealth,
  buildIncident,
  buildMetrics,
  DEPLOY_AT,
  SERVICE,
} from './fixtures.js';
import type { AuditEntry, Deployment, Incident, MetricSample, ServiceHealth } from './types.js';

export interface RollbackResult {
  readonly rolled_back: string;
  readonly now_live: string;
  readonly service: string;
  readonly at: string;
}

export class EstateStore {
  #incident: Incident;
  #deployments: Deployment[];
  #metrics: MetricSample[];
  #audit: AuditEntry[] = [];
  /** Set when a rollback lands, so metrics can recover from that moment onward. */
  #recoveryStartedAt: number | null = null;

  constructor() {
    this.#incident = buildIncident();
    this.#deployments = buildDeployments();
    this.#metrics = buildMetrics();
  }

  /** Restore the pre-incident fixture. Used by tests and demo rehearsal. */
  reset(): void {
    this.#incident = buildIncident();
    this.#deployments = buildDeployments();
    this.#metrics = buildMetrics();
    this.#audit = [];
    this.#recoveryStartedAt = null;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  getIncident(id: string): Incident | undefined {
    return this.#incident.id === id ? this.#incident : undefined;
  }

  listIncidents(): readonly Incident[] {
    return [this.#incident];
  }

  listDeployments(service: string, limit: number): readonly Deployment[] {
    return this.#deployments.filter((d) => d.service === service).slice(0, limit);
  }

  getDeployment(id: string): Deployment | undefined {
    return this.#deployments.find((d) => d.id === id);
  }

  liveDeployment(service: string): Deployment | undefined {
    return this.#deployments.find((d) => d.service === service && d.status === 'live');
  }

  getHealth(service: string): ServiceHealth | undefined {
    if (service !== SERVICE) return undefined;
    const live = this.liveDeployment(service);
    return live ? buildHealth(live.id) : undefined;
  }

  /**
   * Metric samples within an inclusive window.
   *
   * After a rollback the tail recovers: latency and error rate decay back toward
   * baseline over four minutes. The agent can therefore *verify* its remediation
   * worked by re-reading metrics, rather than being told that it did.
   */
  getMetrics(service: string, fromIso?: string, toIso?: string): readonly MetricSample[] {
    if (service !== SERVICE) return [];

    const from = fromIso ? Date.parse(fromIso) : Number.NEGATIVE_INFINITY;
    const to = toIso ? Date.parse(toIso) : Number.POSITIVE_INFINITY;
    const recovery = this.#recoveryStartedAt;

    return this.#metrics
      .filter((s) => {
        const t = Date.parse(s.ts);
        return t >= from && t <= to;
      })
      .map((s) => {
        if (recovery === null) return s;
        const t = Date.parse(s.ts);
        if (t < recovery) return s;

        const decay = Math.min(1, (t - recovery) / (4 * 60_000));
        const eased = 1 - (1 - decay) ** 2;
        const baselineP95 = 178;
        const baselineErr = 0.004;
        return {
          ...s,
          p95_latency_ms:
            Math.round((s.p95_latency_ms + (baselineP95 - s.p95_latency_ms) * eased) * 10) / 10,
          error_rate: Math.round((s.error_rate + (baselineErr - s.error_rate) * eased) * 1e5) / 1e5,
        };
      });
  }

  /**
   * The moment the currently-live deployment went out, for change-point analysis.
   *
   * Derived from live state rather than the fixture constant. Returning
   * `DEPLOY_AT` unconditionally was wrong after a rollback: the agent is told to
   * use this as its candidate change point, so once `dpl-4c21` is retired and
   * `dpl-4c20` is live, a fixed anchor points at a deployment that is no longer
   * running. Any post-remediation verification would then split its series at the
   * wrong timestamp and conclude the rollback had not worked.
   *
   * Falls back to the fixture constant only when no deployment is live, which
   * cannot happen with the seeded estate but would otherwise return `undefined`.
   */
  deployAnchor(service: string = SERVICE): string {
    const live = this.liveDeployment(service);
    return live ? live.deployed_at : new Date(DEPLOY_AT).toISOString();
  }

  listAudit(): readonly AuditEntry[] {
    return this.#audit;
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /** Append a note to an incident. Non-production state: `write`, not `destructive`. */
  addIncidentNote(incidentId: string, author: string, body: string): Incident | undefined {
    const incident = this.getIncident(incidentId);
    if (!incident) return undefined;

    const at = new Date().toISOString();
    incident.notes.push({ at, author, body });
    this.#record('post_incident_note', author, `Note added to ${incidentId}`, {
      incident_id: incidentId,
      body,
    });
    return incident;
  }

  /**
   * Roll the service back to the deployment preceding `deploymentId`.
   *
   * The only method in this class that changes production state, and the reason
   * the `rollback_deployment` tool is annotated `destructiveHint: true`.
   */
  rollbackDeployment(
    deploymentId: string,
    actor: string,
    /**
     * Which tool performed this, for the audit entry.
     *
     * Defaulted rather than required so every existing caller is unchanged. It
     * exists because the audit log is used as an *independent oracle* — by
     * `prove:gate` and by the UI's cross-check — and an oracle that reports the
     * wrong tool name is worse than no oracle. The unannotated twin performs the
     * identical mutation, and hardcoding the name here attributed its bypass to
     * the very tool whose gate had just been demonstrated to work.
     */
    tool: string = 'rollback_deployment',
  ): RollbackResult {
    const target = this.getDeployment(deploymentId);
    if (!target) {
      throw new EstateError(`Unknown deployment: ${deploymentId}`);
    }
    if (target.status !== 'live') {
      throw new EstateError(
        `Deployment ${deploymentId} is ${target.status}, not live. Only the live deployment can be rolled back.`,
      );
    }

    const ordered = this.#deployments
      .filter((d) => d.service === target.service)
      .sort((a, b) => Date.parse(b.deployed_at) - Date.parse(a.deployed_at));
    const predecessor = ordered.find(
      (d) => Date.parse(d.deployed_at) < Date.parse(target.deployed_at),
    );
    if (!predecessor) {
      throw new EstateError(
        `No deployment precedes ${deploymentId}; there is nothing to roll back to.`,
      );
    }

    target.status = 'rolled_back';
    predecessor.status = 'live';

    const at = new Date().toISOString();
    this.#recoveryStartedAt = Date.parse(at);
    this.#incident.status = 'mitigated';

    this.#record(
      tool,
      actor,
      `Rolled ${target.service} back from ${target.id} to ${predecessor.id}`,
      {
        rolled_back: target.id,
        now_live: predecessor.id,
        service: target.service,
      },
    );

    return {
      rolled_back: target.id,
      now_live: predecessor.id,
      service: target.service,
      at,
    };
  }

  /** Restart a service's replicas. Production state: `destructive`. */
  restartService(
    service: string,
    actor: string,
  ): { service: string; replicas: number; at: string } {
    const health = this.getHealth(service);
    if (!health) {
      throw new EstateError(`Unknown service: ${service}`);
    }
    const at = new Date().toISOString();
    this.#record('restart_service', actor, `Restarted ${service}`, {
      service,
      replicas: health.replicas_desired,
    });
    return { service, replicas: health.replicas_desired, at };
  }

  #record(tool: string, actor: string, summary: string, details: Record<string, unknown>): void {
    this.#audit.push({
      at: new Date().toISOString(),
      tool,
      actor,
      summary,
      details,
    });
  }
}

/** Thrown for caller errors that should reach the agent as a readable message. */
export class EstateError extends Error {
  override readonly name = 'EstateError';
}

/** Process-wide store. One simulated estate per server. */
export const estate = new EstateStore();
