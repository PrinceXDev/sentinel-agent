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
 *
 * The store holds exactly one scenario at a time (see `scenarios.ts`). It boots
 * on the checkout regression and `load()` swaps it, which is how `npm run bench`
 * walks all four cases through the same agent without restarting anything.
 */

import { DEPLOY_AT, defaultScenario, type Scenario, SERVICE, scenarioById } from './scenarios.js';
import { jitter, round } from './series.js';
import type {
  AuditEntry,
  Deployment,
  Finding,
  FindingAudit,
  Incident,
  MetricSample,
  ServiceHealth,
} from './types.js';

export interface RollbackResult {
  readonly rolled_back: string;
  readonly now_live: string;
  readonly service: string;
  readonly at: string;
}

/**
 * What a destructive call *would* do, computed without doing it.
 *
 * Returned by the read-only `preview_remediation` tool so the approver sees the
 * exact state transition rather than a sentence describing it. A preview that
 * could diverge from the real call would be worse than none, so both are derived
 * from the same `#resolveRollback` — the preview cannot say one thing while the
 * mutation does another.
 */
export interface RemediationPreview {
  readonly tool: string;
  readonly service: string;
  readonly executable: boolean;
  /** Why it cannot run, when `executable` is false. */
  readonly blocked_reason: string | null;
  readonly changes: readonly {
    readonly subject: string;
    readonly field: string;
    readonly from: string;
    readonly to: string;
  }[];
  readonly reversible: boolean;
  readonly reversal: string;
  readonly blast_radius: string;
}

/**
 * The actor a finding is recorded under.
 *
 * The investigating agent. An audit claiming this name is a self-audit wearing a
 * reviewer's label, and is refused — the weakest of checks, but the only one
 * available: MCP calls carry no caller identity, so the server cannot otherwise
 * tell the investigator from the reviewer.
 */
export const INVESTIGATOR_ACTOR = 'sentinel-agent';

export class EstateStore {
  #scenario: Scenario;
  #incident: Incident;
  #deployments: Deployment[];
  #metrics: MetricSample[];
  #audit: AuditEntry[] = [];
  /**
   * Structured conclusions, newest last. More than one is normal: a denied
   * remediation should produce a revised finding rather than a retry of the
   * same one, and keeping the superseded version is what lets the UI show that
   * the agent actually changed its mind.
   */
  #findings: Finding[] = [];
  /**
   * Set when a remediation lands, so metrics can recover from that moment onward.
   *
   * Anchored to the estate's own clock — the last sample in the window — not to
   * wall-clock now. The fixtures are dated, and the previous implementation
   * decayed samples from `Date.now()`, which is later than every sample that
   * exists: the decay branch ran, matched nothing, and the tail was returned
   * unchanged. The agent is instructed to re-read metrics and confirm the symptom
   * is recovering, and the estate could not show it recovering. A verification
   * step that can only ever report "no change" trains the agent to skip it.
   */
  #recoveryStartedAt: number | null = null;

  constructor(scenario: Scenario = defaultScenario()) {
    this.#scenario = scenario;
    this.#incident = scenario.buildIncident();
    this.#deployments = scenario.buildDeployments();
    this.#metrics = scenario.buildMetrics();
  }

  /** Restore the current scenario's fixture. Used by tests and demo rehearsal. */
  reset(): void {
    this.#incident = this.#scenario.buildIncident();
    this.#deployments = this.#scenario.buildDeployments();
    this.#metrics = this.#scenario.buildMetrics();
    this.#audit = [];
    this.#findings = [];
    this.#recoveryStartedAt = null;
  }

  /**
   * Swap in a different scenario and reset to its fixture.
   *
   * Throws on an unknown id rather than silently keeping the current scenario —
   * a bench run that scored case 3 against case 1's estate would report a
   * confident, meaningless number.
   */
  load(scenarioId: string): Scenario {
    const scenario = scenarioById(scenarioId);
    if (!scenario) {
      throw new EstateError(`Unknown scenario: ${scenarioId}`);
    }
    this.#scenario = scenario;
    this.reset();
    return scenario;
  }

  get scenario(): Scenario {
    return this.#scenario;
  }

  /** The service this scenario's estate is about. */
  get service(): string {
    return this.#scenario.service;
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
    if (service !== this.#scenario.service) return undefined;
    const live = this.liveDeployment(service);
    return live ? this.#scenario.buildHealth(live.id) : undefined;
  }

  /**
   * Metric samples within an inclusive window.
   *
   * After a remediation lands, twelve further minutes of samples exist, decaying
   * back toward the scenario's baseline over the first four. The agent can
   * therefore *verify* its remediation worked by re-reading metrics and finding
   * new data, rather than being told that it worked.
   *
   * The pre-remediation window is never rewritten, so an analysis the agent
   * already ran does not change underneath it.
   */
  getMetrics(service: string, fromIso?: string, toIso?: string): readonly MetricSample[] {
    if (service !== this.#scenario.service) return [];

    const from = fromIso ? Date.parse(fromIso) : Number.NEGATIVE_INFINITY;
    const to = toIso ? Date.parse(toIso) : Number.POSITIVE_INFINITY;

    return this.#metrics.filter((s) => {
      const t = Date.parse(s.ts);
      return t >= from && t <= to;
    });
  }

  /**
   * The estate's own "now" — the timestamp of the most recent sample.
   *
   * The fixtures are dated, so wall-clock time is meaningless inside this estate.
   * Everything time-relative resolves against this instead.
   */
  #estateNow(): number {
    const last = this.#metrics.at(-1);
    return last ? Date.parse(last.ts) : Date.parse(this.deployAnchor());
  }

  /**
   * Extend the series with samples showing the symptom decaying back to baseline.
   *
   * Called once, when a remediation lands. Appending real samples rather than
   * rewriting existing ones is what makes verification honest: the window the
   * agent already analysed does not silently change under it, and the recovery it
   * is asked to confirm is new data that genuinely arrived after the action.
   *
   * Signals that never moved are carried forward at their last value — a recovery
   * that also "fixed" throughput would be a tell that the data is synthetic.
   */
  #appendRecovery(): void {
    const RECOVERY_MINUTES = 12;
    const RAMP_MINUTES = 4;

    const last = this.#metrics.at(-1);
    if (!last) return;

    const { p95: baselineP95, errorRate: baselineErr } = this.#scenario.baseline;
    const startMs = Date.parse(last.ts);
    const fromP95 = last.p95_latency_ms;
    const fromP50 = last.p50_latency_ms;
    const fromErr = last.error_rate;
    // p50 recovers toward whatever fraction of baseline it was already sitting at
    // before the incident, rather than toward a constant — in the checkout case
    // the median never moved, so it must not move now either.
    const p50Target = fromP50 * (baselineP95 / fromP95);

    for (let i = 1; i <= RECOVERY_MINUTES; i += 1) {
      const ts = startMs + i * 60_000;
      const decay = Math.min(1, i / RAMP_MINUTES);
      const eased = 1 - (1 - decay) ** 2;

      this.#metrics.push({
        ts: new Date(ts).toISOString(),
        p95_latency_ms: round(fromP95 + (baselineP95 - fromP95) * eased + jitter(i, 11) * 5, 1),
        p50_latency_ms: round(fromP50 + (p50Target - fromP50) * eased + jitter(i, 12) * 2, 1),
        error_rate: round(
          Math.max(0, fromErr + (baselineErr - fromErr) * eased + jitter(i, 13) * 0.0008),
          5,
        ),
        // Unchanged. Throughput was never the problem and must not appear to be.
        rps: round(last.rps + jitter(i, 14) * 5, 1),
      });
    }
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
   * It is a *candidate*, not the answer. In `payments-upstream-decoy` the true
   * change point precedes this by five minutes, and an agent that anchors here
   * without checking where the series actually steps implicates an innocent
   * deployment.
   *
   * Falls back to the fixture constant only when no deployment is live, which
   * cannot happen with a seeded scenario but would otherwise return `undefined`.
   */
  deployAnchor(service: string = this.#scenario.service): string {
    const live = this.liveDeployment(service);
    return live ? live.deployed_at : new Date(DEPLOY_AT).toISOString();
  }

  /** Wall-clock moment a remediation landed, or null if none has. */
  remediatedAt(): string | null {
    return this.#recoveryStartedAt === null
      ? null
      : new Date(this.#recoveryStartedAt).toISOString();
  }

  listAudit(): readonly AuditEntry[] {
    return this.#audit;
  }

  listFindings(): readonly Finding[] {
    return this.#findings;
  }

  /** The current conclusion — the most recent finding, or null before one is recorded. */
  latestFinding(): Finding | null {
    return this.#findings.at(-1) ?? null;
  }

  // ── Dry run ──────────────────────────────────────────────────────────────

  /**
   * Resolve a rollback to the pair of deployments it would move, or the reason it
   * cannot run. Shared by `previewRollback` and `rollbackDeployment` so a preview
   * can never describe a transition the real call would not perform.
   */
  #resolveRollback(
    deploymentId: string,
  ): { target: Deployment; predecessor: Deployment } | { blocked: string } {
    const target = this.getDeployment(deploymentId);
    if (!target) return { blocked: `Unknown deployment: ${deploymentId}` };
    if (target.status !== 'live') {
      return {
        blocked: `Deployment ${deploymentId} is ${target.status}, not live. Only the live deployment can be rolled back.`,
      };
    }

    const ordered = this.#deployments
      .filter((d) => d.service === target.service)
      .sort((a, b) => Date.parse(b.deployed_at) - Date.parse(a.deployed_at));
    const predecessor = ordered.find(
      (d) => Date.parse(d.deployed_at) < Date.parse(target.deployed_at),
    );
    if (!predecessor) {
      return {
        blocked: `No deployment precedes ${deploymentId}; there is nothing to roll back to.`,
      };
    }

    return { target, predecessor };
  }

  previewRollback(deploymentId: string): RemediationPreview {
    const resolved = this.#resolveRollback(deploymentId);

    if ('blocked' in resolved) {
      const target = this.getDeployment(deploymentId);
      return {
        tool: 'rollback_deployment',
        service: target?.service ?? this.#scenario.service,
        executable: false,
        blocked_reason: resolved.blocked,
        changes: [],
        reversible: true,
        reversal: 'Nothing would change, so nothing would need reversing.',
        blast_radius: 'None — the call would be rejected before touching the estate.',
      };
    }

    const { target, predecessor } = resolved;
    const health = this.getHealth(target.service);

    return {
      tool: 'rollback_deployment',
      service: target.service,
      executable: true,
      blocked_reason: null,
      changes: [
        { subject: target.id, field: 'status', from: 'live', to: 'rolled_back' },
        { subject: predecessor.id, field: 'status', from: predecessor.status, to: 'live' },
        {
          subject: target.service,
          field: 'running_version',
          from: target.version,
          to: predecessor.version,
        },
        {
          subject: this.#incident.id,
          field: 'status',
          from: this.#incident.status,
          to: 'mitigated',
        },
      ],
      reversible: true,
      reversal: `Forward-deploy ${target.version} (commit ${target.commit_sha}) again. The rollback itself cannot be undone in place.`,
      blast_radius: health
        ? `${health.replicas_desired} replica(s) of ${target.service} restart onto ${predecessor.version}. In-flight requests on the ${health.replicas_ready} ready replica(s) are dropped.`
        : `All replicas of ${target.service} restart onto ${predecessor.version}.`,
    };
  }

  previewRestart(service: string): RemediationPreview {
    const health = this.getHealth(service);
    if (!health) {
      return {
        tool: 'restart_service',
        service,
        executable: false,
        blocked_reason: `Unknown service: ${service}`,
        changes: [],
        reversible: true,
        reversal: 'Nothing would change, so nothing would need reversing.',
        blast_radius: 'None — the call would be rejected before touching the estate.',
      };
    }

    return {
      tool: 'restart_service',
      service,
      executable: true,
      blocked_reason: null,
      changes: [
        {
          subject: service,
          field: 'replicas_ready',
          from: String(health.replicas_ready),
          to: `0 → ${health.replicas_desired} (rolling)`,
        },
        { subject: service, field: 'connection_pools', from: 'warm', to: 'cleared' },
      ],
      // Deliberately not claimed as reversible. A restart cannot be un-restarted,
      // and the dropped requests are gone — describing it as low-risk because the
      // end state looks the same is exactly the reasoning that gets a checkout
      // flow truncated mid-payment.
      reversible: false,
      reversal:
        'A restart cannot be undone. Dropped in-flight requests are not replayed. The service ' +
        'returns to the same version it was already running.',
      blast_radius: `${health.replicas_desired} replica(s) of ${service} cycle. Requests in flight at the moment each replica drains are dropped. The deployed version does not change, so a code-caused symptom will return.`,
    };
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
   * Record a structured conclusion against an incident.
   *
   * `audit` starts null and is filled in by `auditFinding`. The two are separate
   * calls, made by separate agents, precisely so the reviewer cannot be the
   * author — a self-audit written in one call would be a field, not a check.
   */
  recordFinding(finding: Omit<Finding, 'at' | 'audit'>): Finding | undefined {
    if (!this.getIncident(finding.incident_id)) return undefined;

    const recorded: Finding = { ...finding, at: new Date().toISOString(), audit: null };
    this.#findings.push(recorded);

    this.#record(
      'record_finding',
      INVESTIGATOR_ACTOR,
      `Finding recorded for ${finding.incident_id}`,
      {
        incident_id: finding.incident_id,
        recommended_action: finding.recommended_action,
        culprit_deployment_id: finding.culprit_deployment_id,
        confidence: finding.confidence,
        evidence_count: finding.evidence.length,
        injections_detected: finding.injections_detected.length,
      },
    );

    return recorded;
  }

  /**
   * Attach a second-opinion critique to the most recent finding.
   *
   * The reviewer's identity is **self-declared and unverified**, and is recorded
   * as such. MCP tool calls carry no caller identity — root agent and subagents
   * reach this server over the same stateless connector with the same token — so
   * "a different agent wrote this" is a convention the agent instructions ask for
   * and nothing here can confirm.
   *
   * The one check that is available is applied: an audit claiming to be the
   * investigating actor is refused outright. That catches the naive self-audit
   * and nothing more, which is why `identity_verified` is stored as `false` and
   * the console says so rather than presenting the second number as independent.
   */
  auditFinding(
    incidentId: string,
    audit: Omit<FindingAudit, 'at' | 'identity_verified'>,
  ): Finding | undefined {
    const target = [...this.#findings].reverse().find((f) => f.incident_id === incidentId);
    if (!target) return undefined;

    if (audit.auditor.trim().toLowerCase() === INVESTIGATOR_ACTOR.toLowerCase()) {
      throw new EstateError(
        `An audit cannot be attributed to ${INVESTIGATOR_ACTOR}, which is the actor that recorded ` +
          'the finding. Dispatch a separate reviewer and give it its own name.',
      );
    }

    target.audit = { ...audit, at: new Date().toISOString(), identity_verified: false };

    this.#record('audit_finding', audit.auditor, `Finding audited for ${incidentId}`, {
      incident_id: incidentId,
      verdict: audit.verdict,
      auditor_confidence: audit.confidence,
      // The number that matters. A large gap means the investigation convinced
      // itself of something its own evidence does not carry.
      confidence_delta: audit.confidence - target.confidence,
      unsupported_claims: audit.unsupported_claims.length,
    });

    return target;
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
    const resolved = this.#resolveRollback(deploymentId);
    if ('blocked' in resolved) {
      throw new EstateError(resolved.blocked);
    }
    const { target, predecessor } = resolved;

    target.status = 'rolled_back';
    predecessor.status = 'live';

    const at = new Date().toISOString();
    this.#recoveryStartedAt = this.#estateNow();
    this.#appendRecovery();
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

export { SERVICE };
