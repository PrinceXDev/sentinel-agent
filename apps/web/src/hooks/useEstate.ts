'use client';

/**
 * Reads the estate's own view of the world.
 *
 * One fetch site for both the incident header and the audit trail, so those
 * components stay presentational and the "when do we re-read" decision lives in
 * exactly one place.
 *
 * Why the UI reads the estate at all, separately from the agent's event stream:
 * this is ground truth. The timeline is the agent's *account* of what it did; the
 * estate is what the system recorded happening. Keeping them as two independent
 * reads is what makes the account checkable rather than merely plausible.
 */

import { useEffect, useState } from 'react';

import {
  type AuditEntry,
  type EstateState,
  estate,
  type Finding,
  firstFailure,
} from '@/lib/estate';

export interface EstateSnapshot {
  state: EstateState | null;
  audit: AuditEntry[] | null;
  /** Every conclusion recorded this run, oldest first. */
  findings: Finding[] | null;
  /** The current conclusion. Null until the agent records one. */
  finding: Finding | null;
  error: string | null;
  loading: boolean;
}

/**
 * One round trip for all three estate reads.
 *
 * Separate from the effect so the effect stays a lifecycle concern — subscribe,
 * guard against a late resolve, unsubscribe — and this stays a data concern.
 * Each read degrades independently: a findings endpoint that a stale ops server
 * does not serve leaves the incident header intact rather than blanking the page.
 */
const readEstate = async (): Promise<EstateSnapshot> => {
  const [stateResult, auditResult, findingsResult] = await Promise.all([
    estate.state(),
    estate.audit(),
    estate.findings(),
  ]);

  const failure = firstFailure([stateResult, auditResult, findingsResult]);

  return {
    state: stateResult.ok ? stateResult.data : null,
    audit: auditResult.ok ? auditResult.data.entries : null,
    findings: findingsResult.ok ? findingsResult.data.findings : null,
    finding: findingsResult.ok ? findingsResult.data.latest : null,
    error: failure?.message ?? null,
    loading: false,
  };
};

export const useEstate = (refreshKey: number): EstateSnapshot => {
  const [snapshot, setSnapshot] = useState<EstateSnapshot>({
    state: null,
    audit: null,
    findings: null,
    finding: null,
    error: null,
    loading: true,
  });

  // `refreshKey` is a change signal, not a value this effect reads — the caller
  // bumps it when the agent stops touching the estate. Biome's rule wants every
  // dependency referenced in the body, which does not model refetch triggers;
  // removing it would pin the panels to their page-load values and the whole
  // point of the panel (showing that the rollback landed) would be lost.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional refetch trigger, not a value read inside the effect
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const snapshot = await readEstate();
      if (!cancelled) setSnapshot(snapshot);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return snapshot;
};
