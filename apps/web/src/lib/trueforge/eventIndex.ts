/**
 * The event index, and the approval join that depends on it.
 *
 * ## Why an index is mandatory
 *
 * `tool.approval_required` is the event that pauses a turn. Its payload is:
 *
 * ```
 * { type, id, created_at, thread_id, tool_calls: [{ id, source_event_id }] }
 * ```
 *
 * That is all. **No tool name. No arguments.** So the harness tells you *that*
 * something needs approval and *which call*, but not *what it does* — and a
 * prompt reading "approve tool call `call_a8f2`?" is not something any human can
 * make a decision on.
 *
 * The missing detail lives in the `model.message` that requested the call. To
 * recover it you follow `source_event_id` to that message and find the matching
 * entry in its `toolCalls` array. That requires having kept every event you have
 * seen, keyed by id — hence this index. It is not a cache or an optimisation;
 * without it the approval UI cannot be built at all.
 *
 * ## Deltas
 *
 * `model.message.delta` events carry fragments that must be folded into the base
 * `model.message` sharing their `id`. The SDK's `isEventDelta` / `mergeEventDelta`
 * do that merge, and doing it here means the index always holds whole messages —
 * so a join that lands on a message still mid-stream reads complete arguments
 * rather than truncated JSON.
 */

import { isEventDelta, mergeEventDelta, type TrueForgeApi } from '@truefoundry/trueforge-sdk';

import type { PendingApproval } from './types';

type AnyEvent = TrueForgeApi.TurnStreamingEvent;

export class EventIndex {
  readonly #byId = new Map<string, AnyEvent>();

  /**
   * Record an event, merging it if it is a delta.
   *
   * Returns the event actually stored — the merged base for a delta, or the
   * event itself otherwise — so callers can react to complete state rather than
   * to a fragment.
   */
  record(event: AnyEvent): AnyEvent {
    if (isEventDelta(event)) {
      const base = this.#byId.get(event.id);
      if (base) {
        mergeEventDelta(base, event);
        return base;
      }
      // A delta whose base was never seen. Can happen when resuming from a
      // sequence cursor mid-message. Store it so the id is at least known;
      // subsequent deltas will merge into it.
      this.#byId.set(event.id, event);
      return event;
    }

    this.#byId.set(event.id, event);
    return event;
  }

  get(id: string): AnyEvent | undefined {
    return this.#byId.get(id);
  }

  get size(): number {
    return this.#byId.size;
  }

  clear(): void {
    this.#byId.clear();
  }
}

/** Parse tool arguments without letting malformed JSON break the render. */
function parseArgs(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // Arguments stream in fragments, so a mid-stream read can be incomplete.
    // The raw string is kept on the view model either way.
    return null;
  }
}

interface ToolCallLike {
  id: string;
  function?: { name?: string; arguments?: string };
  toolInfo?: {
    type?: string;
    name?: string;
    server_name?: string;
    serverName?: string;
  };
}

/** Pull name, server, and arguments off a tool call, whatever shape it arrived in. */
export function describeToolCall(call: ToolCallLike): {
  name: string;
  serverName: string | null;
  kind: 'mcp' | 'system';
  argsRaw: string;
  args: unknown;
} {
  const info = call.toolInfo;
  // `toolInfo.name` is the authoritative tool name; `function.name` is what the
  // model emitted and can be namespaced. Prefer the former, fall back cleanly.
  const name = info?.name ?? call.function?.name ?? 'unknown_tool';
  const serverName = info?.server_name ?? info?.serverName ?? null;
  const argsRaw = call.function?.arguments ?? '';

  return {
    name,
    serverName,
    kind: info?.type === 'mcp' ? 'mcp' : 'system',
    argsRaw,
    args: parseArgs(argsRaw),
  };
}

/**
 * Join a `tool.approval_required` event against the index into approvals a human
 * can actually read.
 *
 * A ref whose source message is missing still yields a `PendingApproval`, marked
 * `resolved: false`. Dropping it would be the worse failure: the turn stays
 * blocked either way, and an approval the UI silently omits is one nobody can
 * clear. Better to show "details unavailable" and still offer the decision.
 */
export function joinApprovals(
  event: TrueForgeApi.ToolApprovalRequiredEvent,
  index: EventIndex,
): PendingApproval[] {
  return event.toolCalls.map((ref): PendingApproval => {
    const source = index.get(ref.sourceEventId);

    if (source?.type === 'model.message' || source?.type === 'model.message.delta') {
      const calls = (source.toolCalls ?? []) as ToolCallLike[];
      const call = calls.find((c) => c.id === ref.id);
      if (call) {
        const described = describeToolCall(call);
        return {
          threadId: event.threadId,
          toolCallId: ref.id,
          sourceEventId: ref.sourceEventId,
          toolName: described.name,
          serverName: described.serverName,
          args: described.args,
          argsRaw: described.argsRaw,
          resolved: true,
        };
      }
    }

    return {
      threadId: event.threadId,
      toolCallId: ref.id,
      sourceEventId: ref.sourceEventId,
      toolName: 'unknown_tool',
      serverName: null,
      args: null,
      argsRaw: '',
      resolved: false,
    };
  });
}
