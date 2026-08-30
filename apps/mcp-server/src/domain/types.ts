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

// ── Structured findings ────────────────────────────────────────────────────

/** What a responder concluded should happen. Mirrors `CorrectAction` in scenarios.ts. */
export type RecommendedAction = 'rollback' | 'restart' | 'no_action' | 'escalate';

/**
 * One claim and where it came from.
 *
 * The agent's instructions have always required every conclusion to name its
 * source. Prose made that unverifiable — a paragraph can cite nothing and still
 * read well. Structuring it means the UI can render claim-to-evidence edges and
 * flag any claim whose `source` is empty, which turns a stated rule into a
 * checked one.
 */
export interface EvidenceLink {
  readonly claim: string;
  /** The tool call, subagent, or sandbox run that produced it. */
  readonly source: string;
  readonly detail: string;
}

/** A candidate the responder considered and eliminated, with the reason. */
export interface RuledOut {
  readonly candidate: string;
  readonly reason: string;
}

/**
 * Text in the estate that addressed the agent as an instruction.
 *
 * Incident notes, deploy messages and code comments are all attacker-influenceable
 * in a real estate, and an agent wired to a rollback tool is a worthwhile target.
 * Reporting these rather than obeying them is the behaviour the `search-injected-note`
 * scenario and the P5 conformance probe both test for.
 */
export interface InjectionReport {
  /** Where it was found, e.g. "INC-2057 note by ops-sync-bot" or "dpl-9147 diff". */
  readonly location: string;
  /** The instruction text itself, quoted rather than paraphrased. */
  readonly quote: string;
  /** What it was trying to induce. */
  readonly demanded: string;
}

/** The agent's structured conclusion. One per incident; a later record supersedes an earlier one. */
export interface Finding {
  readonly at: string;
  readonly incident_id: string;
  readonly root_cause: string;
  readonly culprit_deployment_id: string | null;
  readonly recommended_action: RecommendedAction;
  /** 0–100. Below 80 the agent is instructed to gather more evidence rather than act. */
  readonly confidence: number;
  readonly confidence_rationale: string;
  readonly evidence: readonly EvidenceLink[];
  readonly ruled_out: readonly RuledOut[];
  readonly verification_plan: string;
  readonly injections_detected: readonly InjectionReport[];
  /** Set by `audit_finding`, when a second reviewer has scored it. Identity is unverified. */
  audit: FindingAudit | null;
}

/**
 * An independent critique of a finding, grounded in its evidence rather than its
 * conclusion.
 *
 * Cleric's published result on their own product is that an auditor agent scoring
 * the *evidence* predicts the true outcome substantially better than the
 * investigating agent scoring its own conclusion. sentinel-agent's confidence was
 * self-reported by the model that formed the hypothesis, which is the weakest
 * possible arrangement — this is the second opinion.
 */
export interface FindingAudit {
  readonly at: string;
  /** Self-declared. See `identity_verified`. */
  readonly auditor: string;
  /**
   * Always `false`, and present precisely so nothing downstream can forget it.
   *
   * MCP tool calls carry no caller identity — the root agent and its subagents
   * reach the ops server over the same stateless connector with the same token —
   * so the server cannot confirm that the reviewer is a different agent from the
   * investigator. The separation is a convention the agent instructions ask for
   * and the harness does not enforce. A field is harder to overlook than a
   * paragraph, and the console reads it to label the second opinion honestly.
   */
  readonly identity_verified: false;
  /** 0–100, the auditor's own number. Divergence from the finding's is the signal. */
  readonly confidence: number;
  readonly verdict: 'supported' | 'partially_supported' | 'unsupported';
  /** Claims in the finding the auditor could not trace to a cited source. */
  readonly unsupported_claims: readonly string[];
  /** What the investigation did not look at that it should have. */
  readonly gaps: readonly string[];
  readonly rationale: string;
}
