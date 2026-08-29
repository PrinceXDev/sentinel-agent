'use client';

/**
 * Drives one agent run and exposes it as state.
 *
 * Everything the harness sends flows through `reduce`; everything the human
 * decides flows back out through `approve` / `deny`. The hook owns three things
 * the reducer cannot: the SDK client, the event index, and the reconnect cursor.
 *
 * ## Re-render strategy
 *
 * `RunState` holds three Maps and a growing array. Cloning them on every event
 * would allocate heavily during a run that emits hundreds. Instead the state is
 * mutated in place and a `version` counter drives re-renders — the standard
 * escape hatch when the data structure is large and the update rate is high.
 * `state` is therefore a stable reference; read it during render, never memoise
 * derived values on it without including `version`.
 */

import type { TrueForge, TrueForgeApi } from '@truefoundry/trueforge-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

import { clearHandle, createClient, loadHandle, saveHandle } from '@/lib/trueforge/client';
import { describeError, isOperatorTokenRefusal } from '@/lib/trueforge/errors';
import { EventIndex } from '@/lib/trueforge/eventIndex';
import { reduce } from '@/lib/trueforge/runReducer';
import {
  emptyRunState,
  type PendingApproval,
  type RunState,
  type RunStatus,
  type ToolCallStatus,
} from '@/lib/trueforge/types';

export interface UseAgentRun {
  readonly state: RunState;
  /** Increments on every applied event. Include in dependency arrays. */
  readonly version: number;
  readonly busy: boolean;
  readonly start: (prompt: string) => Promise<void>;
  readonly approve: (toolCallId: string) => Promise<void>;
  readonly deny: (toolCallId: string, reason?: string) => Promise<void>;
  readonly cancel: () => Promise<void>;
  readonly reset: () => void;
  /**
   * Set when the proxy refused a state-changing call for want of a valid
   * operator token. Carries the server's own reason, so the prompt explains the
   * actual refusal rather than a guess at it. Null when no token is needed.
   */
  readonly tokenRefusal: string | null;
  /** Clear the refusal after a token is entered, so the operator can retry. */
  readonly clearTokenRefusal: () => void;
}

/** Shape of the /api/agent-spec response. */
interface SpecResponse {
  spec?: TrueForgeApi.AgentSpec;
  error?: string;
  message?: string;
}

/** A stream of turn events, as returned by `createTurnStream` / `subscribeToTurn`. */
type TurnStream = {
  withMetadata: () => AsyncIterable<{
    data: TrueForgeApi.TurnStreamingEvent;
    id?: string | undefined;
  }>;
};

type ConsumeFn = (stream: TurnStream, sessionId: string) => Promise<void>;

/** Mutable flag so an unmount can stop an in-flight resume mid-await. */
interface Cancellation {
  cancelled: boolean;
}

/**
 * Reflect a decision in the UI before the server confirms it.
 *
 * The gate must stop looking pending the moment it is clicked — a human who
 * clicks Approve and sees the prompt sit there will click again, and a duplicate
 * approval for an already-resolved call is a 422. The authoritative state still
 * arrives via events; this only closes the window between click and first event.
 */
const applyDecisionOptimistically = (
  state: RunState,
  toolCallId: string,
  status: 'allow' | 'deny',
): void => {
  const call = state.toolCalls.get(toolCallId);
  if (call) call.status = status === 'allow' ? 'running' : 'denied';
  state.pendingApprovals = state.pendingApprovals.filter((a) => a.toolCallId !== toolCallId);
  state.status = 'running';
};

/** What was true before an optimistic decision, so a failure can be undone. */
interface DecisionSnapshot {
  readonly approvals: PendingApproval[];
  readonly toolCallStatus: ToolCallStatus | null;
  readonly toolCallId: string;
  readonly runStatus: RunStatus;
}

const snapshotDecision = (state: RunState, toolCallId: string): DecisionSnapshot => {
  return {
    approvals: [...state.pendingApprovals],
    toolCallStatus: state.toolCalls.get(toolCallId)?.status ?? null,
    toolCallId,
    runStatus: state.status,
  };
};

/**
 * Undo an optimistic decision whose submission failed.
 *
 * Skipped when the tool call has since completed: that means the decision
 * actually reached the harness and the failure was in reading the response, so
 * re-offering the approval would produce a duplicate submission and a 422.
 */
const restoreDecision = (state: RunState, snapshot: DecisionSnapshot): void => {
  const call = state.toolCalls.get(snapshot.toolCallId);
  if (call?.status === 'completed') return;

  state.pendingApprovals = snapshot.approvals;
  if (call && snapshot.toolCallStatus) call.status = snapshot.toolCallStatus;
  state.status = snapshot.runStatus;
};

/**
 * Re-attach to a turn that was in flight when the page unloaded.
 *
 * There is no resume endpoint, so recovery is a decision tree:
 *
 *  1. `getTurn` — is this turn still running?
 *  2. `listTurnEvents` — replay what was persisted, so the timeline is populated
 *     rather than starting blank from the cursor onward.
 *  3. If still running, `subscribeToTurn` from the stored cursor to pick up the
 *     live tail. A 412 here means the live buffer is gone, and the replay from
 *     step 2 is all there is — which is why the replay happens first
 *     unconditionally rather than only in the terminal branch.
 *
 * Extracted from the hook because it is the one piece of logic here worth
 * reading on its own, and because a five-argument pure-ish function is easier to
 * follow than the same branching nested inside an effect.
 */
const resumeRun = async (args: {
  handle: { sessionId: string; turnId: string; lastSequenceNumber: number };
  client: TrueForge;
  state: RunState;
  index: EventIndex;
  cancellation: Cancellation;
  consume: ConsumeFn;
  onProgress: () => void;
}): Promise<void> => {
  const { handle, client, state, index, cancellation, consume, onProgress } = args;

  const { data: turn } = await client.sessions.getTurn(handle.sessionId, handle.turnId);
  if (cancellation.cancelled) return;

  (state as { sessionId: string | null }).sessionId = handle.sessionId;
  (state as { turnId: string | null }).turnId = handle.turnId;
  state.lastSequenceNumber = handle.lastSequenceNumber;

  for await (const event of await client.sessions.listTurnEvents(handle.sessionId, handle.turnId)) {
    if (cancellation.cancelled) return;
    reduce(state, event as TrueForgeApi.TurnStreamingEvent, index);
  }
  onProgress();

  if (turn.state.status !== 'running') return;

  const stream = await client.sessions.subscribeToTurn(handle.sessionId, handle.turnId, {
    afterSequenceNumber: handle.lastSequenceNumber,
  });
  if (cancellation.cancelled) return;
  await consume(stream, handle.sessionId);
};

export const useAgentRun = (): UseAgentRun => {
  const stateRef = useRef<RunState>(emptyRunState());
  const indexRef = useRef<EventIndex>(new EventIndex());
  const clientRef = useRef<TrueForge | null>(null);
  /**
   * Identifies the current run. Incremented by `start()` and `reset()`; a
   * `consume` loop that finds it changed stops writing. This is the only thing
   * preventing a superseded stream from repopulating fresh state.
   */
  const generationRef = useRef(0);

  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tokenRefusal, setTokenRefusal] = useState<string | null>(null);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const client = useCallback((): TrueForge => {
    clientRef.current ??= createClient();
    return clientRef.current;
  }, []);

  const fail = useCallback(
    (message: string) => {
      stateRef.current.status = 'error';
      stateRef.current.error = message;
      bump();
    },
    [bump],
  );

  /**
   * Consume a stream of turn events into state.
   *
   * `id` from the SSE frame is the sequence number, and it is the resume cursor —
   * tracked on every event so a mid-stream disconnect can pick up exactly where
   * it stopped rather than replaying the run.
   */
  const consume = useCallback(
    async (
      stream: {
        withMetadata: () => AsyncIterable<{
          data: TrueForgeApi.TurnStreamingEvent;
          id?: string | undefined;
        }>;
      },
      sessionId: string,
    ) => {
      // Capture the generation this stream belongs to. `reset()` and `start()`
      // increment it, so events arriving from a superseded run are dropped
      // instead of writing into the state that replaced it.
      const generation = generationRef.current;

      for await (const { data: event, id } of stream.withMetadata()) {
        if (generation !== generationRef.current) return;

        if (id != null) {
          const seq = Number(id);
          if (Number.isFinite(seq)) stateRef.current.lastSequenceNumber = seq;
        }

        reduce(stateRef.current, event, indexRef.current);

        const { turnId, lastSequenceNumber } = stateRef.current;
        if (turnId) saveHandle({ sessionId, turnId, lastSequenceNumber });

        bump();
      }
    },
    [bump],
  );

  const start = useCallback(
    async (prompt: string) => {
      if (busy) return;
      setBusy(true);

      // A new investigation is a new session; clear anything from the last one.
      // Bumping the generation first invalidates any stream still consuming from
      // the previous run, so its events cannot land in this one's state.
      generationRef.current += 1;
      stateRef.current = emptyRunState();
      indexRef.current.clear();
      clearHandle();
      stateRef.current.status = 'starting';
      bump();

      try {
        const specResponse = await fetch('/api/agent-spec', {
          cache: 'no-store',
        });
        const payload = (await specResponse.json()) as SpecResponse;
        if (!specResponse.ok || !payload.spec) {
          fail(payload.message ?? 'Could not load the agent spec.');
          return;
        }

        const tf = client();

        // Inline spec rather than a saved agent by name. `require_approval_for_tools`
        // is API-only — it cannot be set through the harness UI — so passing the
        // spec inline is what guarantees the gate is configured as committed.
        const { data: session } = await tf.sessions.create({
          agent: { spec: payload.spec },
        });
        (stateRef.current as { sessionId: string | null }).sessionId = session.id;
        bump();

        const stream = await tf.sessions.createTurnStream(session.id, {
          input: [{ type: 'user.message', content: prompt }],
        });
        await consume(stream, session.id);
      } catch (error) {
        // `sessions.create` is this hook's first mutating call, so it is the
        // most common place an operator token refusal is ever seen — missing
        // this check here (present in `respond`/`cancel`) is what let the raw
        // 403 fall through to the generic error state instead of the token
        // prompt. Reset to 'idle' rather than leaving 'starting': the operator
        // has done nothing wrong, and the Investigate button must re-enable
        // once they've entered a token.
        if (isOperatorTokenRefusal(error)) {
          setTokenRefusal(describeError(error));
          stateRef.current.status = 'idle';
          bump();
        } else {
          fail(describeError(error));
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, bump, client, consume, fail],
  );

  /**
   * Resolve one pending approval.
   *
   * There is no approval endpoint: a decision is a **new turn** whose input is
   * approval items. Two constraints from the API contract are load-bearing here —
   * one item per pending tool call, and approval items must never be mixed with
   * a user message in the same turn, which returns 422.
   */
  const respond = useCallback(
    async (toolCallId: string, approval: TrueForgeApi.ApprovalDecision) => {
      const { sessionId } = stateRef.current;
      const pending = stateRef.current.pendingApprovals.find((a) => a.toolCallId === toolCallId);
      if (!sessionId || !pending) return;
      if (busy) return;

      setBusy(true);
      // Snapshot before the optimistic update so a failed submission can be
      // undone. Without this, a dropped network request removes the approval
      // card while the harness is still blocked on that exact decision — the
      // operator is left with a stalled run and no way to retry it.
      const snapshot = snapshotDecision(stateRef.current, toolCallId);
      try {
        applyDecisionOptimistically(stateRef.current, toolCallId, approval.status);
        bump();

        const tf = client();
        const stream = await tf.sessions.createTurnStream(sessionId, {
          input: [
            {
              type: 'user.tool_approval',
              threadId: pending.threadId,
              toolCallId: pending.toolCallId,
              approval,
            },
          ],
        });
        await consume(stream, sessionId);
      } catch (error) {
        // Restore only if the server has not since resolved it by other means —
        // a late `tool.response` for this call means the decision did land, and
        // re-showing the prompt would invite a duplicate that returns 422.
        restoreDecision(stateRef.current, snapshot);

        // A token refusal is recoverable: the approval is back on screen and the
        // operator can supply a token and click again. Routing it to `fail()`
        // would put the run into a terminal error state over something fixable.
        if (isOperatorTokenRefusal(error)) {
          setTokenRefusal(describeError(error));
          bump();
        } else {
          fail(describeError(error));
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, bump, client, consume, fail],
  );

  const approve = useCallback(
    (toolCallId: string) => respond(toolCallId, { status: 'allow' }),
    [respond],
  );

  const deny = useCallback(
    (toolCallId: string, reason?: string) =>
      respond(toolCallId, reason ? { status: 'deny', reason } : { status: 'deny' }),
    [respond],
  );

  const cancel = useCallback(async () => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    try {
      await client().sessions.cancel(sessionId);
      stateRef.current.status = 'cancelled';
      bump();
    } catch (error) {
      // Cancelling is a POST, so it is gated too. Same reasoning as `respond`:
      // recoverable, so prompt rather than entering a terminal error state.
      if (isOperatorTokenRefusal(error)) {
        setTokenRefusal(describeError(error));
        bump();
      } else {
        fail(describeError(error));
      }
    }
  }, [bump, client, fail]);

  /**
   * Clear the local view of a run.
   *
   * Bumps the generation token, which is what actually stops a still-running
   * stream from writing into the fresh state. Replacing `stateRef.current` alone
   * was not enough: an in-flight `consume` loop holds no reference to the old
   * object — it reads `stateRef.current` on every event — so after a reset it
   * would happily repopulate the new state with the previous run's timeline and,
   * worse, its pending approvals.
   *
   * Note what this does *not* do: it does not stop the turn executing on the
   * harness. Only `cancel()` does that. Named `reset` rather than `stop` for
   * exactly that reason.
   */
  const reset = useCallback(() => {
    generationRef.current += 1;
    stateRef.current = emptyRunState();
    indexRef.current.clear();
    clearHandle();
    bump();
  }, [bump]);

  /**
   * Re-attach to a run in progress after a reload.
   *
   * The decision tree lives in `resumeRun`; this effect only supplies it with
   * the pieces the hook owns and handles cancellation on unmount.
   */
  useEffect(() => {
    const handle = loadHandle();
    if (!handle) return;

    const cancellation = { cancelled: false };

    void resumeRun({
      handle,
      client: client(),
      state: stateRef.current,
      index: indexRef.current,
      cancellation,
      consume,
      onProgress: bump,
    }).catch(() => {
      // A stale handle — session deleted, harness restarted, buffer expired.
      // Not worth surfacing: drop it and present a clean slate.
      clearHandle();
    });

    return () => {
      cancellation.cancelled = true;
    };
  }, [bump, client, consume]);

  const clearTokenRefusal = useCallback(() => setTokenRefusal(null), []);

  return {
    state: stateRef.current,
    version,
    busy,
    start,
    approve,
    deny,
    cancel,
    reset,
    tokenRefusal,
    clearTokenRefusal,
  };
};
