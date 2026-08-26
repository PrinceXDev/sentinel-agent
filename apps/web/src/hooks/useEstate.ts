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

import { type AuditEntry, type EstateState, estate, firstFailure } from '@/lib/estate';

export interface EstateSnapshot {
  state: EstateState | null;
  audit: AuditEntry[] | null;
  error: string | null;
  loading: boolean;
}

export function useEstate(refreshKey: number): EstateSnapshot {
  const [snapshot, setSnapshot] = useState<EstateSnapshot>({
    state: null,
    audit: null,
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
      const [stateResult, auditResult] = await Promise.all([estate.state(), estate.audit()]);
      if (cancelled) return;

      const failure = firstFailure([stateResult, auditResult]);

      setSnapshot({
        state: stateResult.ok ? stateResult.data : null,
        audit: auditResult.ok ? auditResult.data.entries : null,
        error: failure?.message ?? null,
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return snapshot;
}
