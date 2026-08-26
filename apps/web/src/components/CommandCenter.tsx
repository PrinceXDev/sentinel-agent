'use client';

/**
 * Layout and orchestration. Holds no investigation logic.
 *
 * Everything on screen is derived either from harness events (via `useAgentRun`)
 * or from the estate's own API (via the brief and audit panels). If this
 * component contained a workflow state machine — "after the tool call, show the
 * sandbox step" — the harness would not be the thing doing the work, and the
 * whole premise would be false. So it composes and renders; nothing more.
 */

import { useEffect, useMemo, useState } from 'react';

import { ApprovalGate } from '@/components/ApprovalGate';
import { ControlPanel } from '@/components/ControlPanel';
import { IncidentBrief } from '@/components/IncidentBrief';
import { OperatorTokenPrompt } from '@/components/OperatorTokenPrompt';
import { Timeline } from '@/components/Timeline';
import { TopBar } from '@/components/TopBar';
import { useAgentRun } from '@/hooks/useAgentRun';
import { useEstate } from '@/hooks/useEstate';
import { activeApprovals, subagents } from '@/lib/trueforge/runReducer';

const DEMO_PROMPT =
  'Investigate incident INC-2048. Checkout latency has risen sharply on checkout-api. ' +
  'Determine whether the most recent deployment caused it, compute the magnitude from raw ' +
  'metrics, and prepare a remediation if the evidence supports one.';

export function CommandCenter() {
  const run = useAgentRun();
  const { state, version, busy } = run;
  const [prompt, setPrompt] = useState(DEMO_PROMPT);
  const [estateRefreshKey, setEstateRefreshKey] = useState(0);

  // `state` is a stable reference mutated in place, so `version` is what makes
  // these recompute. Omitting it would freeze the UI on the first render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version is the change signal for the mutable state object
  const approvals = useMemo(() => activeApprovals(state), [state, version]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version is the change signal for the mutable state object
  const threads = useMemo(() => subagents(state), [state, version]);

  // Re-read the estate whenever the agent stops touching it, so the brief and
  // audit panels reflect the outcome rather than the state at page load. Keyed on
  // status transitions rather than on every event — the estate does not change
  // between tool calls, and polling it during a run would be noise.
  const { status } = state;
  useEffect(() => {
    if (status === 'done' || status === 'awaiting_approval' || status === 'error') {
      setEstateRefreshKey((k) => k + 1);
    }
  }, [status]);

  const estate = useEstate(estateRefreshKey);
  const canStart = status !== 'running' && status !== 'awaiting_approval' && !busy;

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        status={status}
        sessionId={state.sessionId}
        sandboxId={state.sandboxId}
        toolCallCount={state.toolCalls.size}
      />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <IncidentBrief state={estate.state} error={estate.error} />

          <div className="shrink-0 border-line border-b px-5 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="eyebrow">brief for the agent</span>
              {state.sessionId && (
                <button
                  type="button"
                  onClick={run.reset}
                  className="text-dim text-xs transition-colors hover:text-ink"
                >
                  Clear run
                </button>
              )}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              disabled={!canStart}
              aria-label="Brief for the agent"
              className="mt-2 w-full resize-y border border-line bg-ground px-3 py-2 text-ink text-sm leading-relaxed placeholder:text-dim focus:border-line-strong focus:outline-none disabled:opacity-60"
            />

            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canStart || prompt.trim().length === 0}
                onClick={() => void run.start(prompt.trim())}
                className="border border-steel bg-steel/10 px-5 py-2 font-medium text-sm text-steel transition-colors hover:bg-steel/20 disabled:opacity-40"
              >
                {busy && status === 'starting' ? 'Opening session…' : 'Investigate'}
              </button>

              {(status === 'running' || status === 'awaiting_approval') && (
                <button
                  type="button"
                  onClick={() => void run.cancel()}
                  className="px-3 py-2 text-muted text-sm transition-colors hover:text-danger"
                >
                  Cancel run
                </button>
              )}

              <p className="ml-auto text-dim text-xs">
                Read-only tools run freely. Anything that changes production stops here.
              </p>
            </div>
          </div>

          {run.tokenRefusal && (
            <OperatorTokenPrompt
              reason={run.tokenRefusal}
              onSaved={run.clearTokenRefusal}
              onDismiss={run.clearTokenRefusal}
            />
          )}

          <ApprovalGate
            approvals={approvals}
            busy={busy}
            onApprove={(id) => void run.approve(id)}
            onDeny={(id, reason) => void run.deny(id, reason)}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <Timeline
              entries={state.timeline}
              rootThreadId={state.rootThreadId}
              toolCalls={state.toolCalls}
            />
          </div>
        </main>

        <ControlPanel state={state} subagents={threads} estate={estate} />
      </div>
    </div>
  );
}
