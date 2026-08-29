/**
 * Turn events → run state.
 *
 * A pure reducer, so the whole event-handling story is testable without a
 * harness, a browser, or a network. `reduce` never mutates its argument's
 * identity-bearing collections in place beyond what the returned state owns, and
 * it never throws: an unrecognised event is recorded and ignored rather than
 * taking the view down mid-incident.
 *
 * ## Event coverage
 *
 * TrueForge emits exactly twelve streaming event types. All twelve are handled
 * below, including the three that only ever appear in `required_actions`. Two
 * things the UI *cannot* show, because no event exists for them:
 *
 *  - **Context compaction.** Configured and enabled by default, but not emitted.
 *  - **Sandbox commands.** Only `sandbox.created` exists; individual `exec` calls
 *    arrive as ordinary tool calls, which is how they are rendered.
 */

import type { TrueForgeApi } from '@truefoundry/trueforge-sdk';

import { describeToolCall, type EventIndex, joinApprovals } from './eventIndex';
import type { PendingApproval, RunState, TimelineEntry, ToolCallView } from './types';

type AnyEvent = TrueForgeApi.TurnStreamingEvent;

/** Truncate a long string for a timeline label without hiding that it was cut. */
const preview = (text: string, max = 120): string => {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
};

const push = (state: RunState, entry: TimelineEntry): void => {
  // Events carry monotonic ULIDs, so arrival order is chronological and a plain
  // append keeps the timeline sorted. Guard against duplicates, which happen
  // when a resume replays an event already seen before the disconnect.
  if (state.timeline.some((e) => e.id === entry.id && e.kind === entry.kind)) return;
  state.timeline.push(entry);
};

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) {
        const { text } = part as { text?: unknown };
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .join('');
};

/**
 * Fold one event into the run state.
 *
 * Mutates and returns `state`. A reducer that cloned three Maps and an array on
 * every event would allocate heavily during a streaming run for no benefit —
 * React re-renders are driven by a version counter in the hook instead.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: an exhaustive switch over the protocol's twelve event types. Splitting it into twelve one-caller functions would scatter the state transitions across the file without removing a single branch, and would make it harder to see that every event type is handled.
export const reduce = (state: RunState, event: AnyEvent, index: EventIndex): RunState => {
  const stored = index.record(event);
  const at =
    'createdAt' in stored && stored.createdAt ? String(stored.createdAt) : new Date().toISOString();

  switch (stored.type) {
    case 'turn.created': {
      const e = stored as TrueForgeApi.TurnCreatedEvent;
      state.status = 'running';
      (state as { turnId: string | null }).turnId = e.turnId;
      state.error = null;
      push(state, {
        id: e.id,
        at,
        kind: 'turn_started',
        threadId: e.threadId ?? null,
        label: 'Investigation started',
        detail: null,
        toolCallId: null,
      });
      return state;
    }

    case 'model.message':
    case 'model.message.delta': {
      const e = stored as TrueForgeApi.ModelMessageEvent;
      const threadId = e.threadId ?? state.rootThreadId;

      // Tool calls announced on a message become tool-call views. There is no
      // dedicated "tool call started" event — this is where a call first exists.
      for (const call of (e.toolCalls ?? []) as Parameters<typeof describeToolCall>[0][]) {
        const described = describeToolCall(call);
        const existing = state.toolCalls.get(call.id);
        if (existing) {
          // Arguments stream in fragments; refresh them as they complete.
          (existing as { args: unknown }).args = described.args;
          (existing as { argsRaw: string }).argsRaw = described.argsRaw;
        } else {
          const view: ToolCallView = {
            id: call.id,
            name: described.name,
            serverName: described.serverName,
            kind: described.kind,
            args: described.args,
            argsRaw: described.argsRaw,
            threadId: threadId ?? '',
            status: 'requested',
            result: null,
            requestedAt: at,
            completedAt: null,
          };
          state.toolCalls.set(call.id, view);
          push(state, {
            id: `${e.id}:${call.id}`,
            at,
            kind: 'tool_call',
            threadId: threadId ?? null,
            label: described.serverName
              ? `${described.serverName} · ${described.name}`
              : described.name,
            detail: described.argsRaw ? preview(described.argsRaw) : null,
            toolCallId: call.id,
          });
        }
      }

      const text = textOf(e.content);
      if (text.trim()) {
        const existing = state.messages.find((m) => m.id === e.id);
        if (existing) {
          existing.content = text;
        } else {
          state.messages.push({
            id: e.id,
            threadId: threadId ?? '',
            content: text,
            at,
          });
          push(state, {
            id: e.id,
            at,
            kind: 'message',
            threadId: threadId ?? null,
            label: preview(text),
            detail: null,
            toolCallId: null,
          });
        }
      }
      return state;
    }

    case 'tool.response': {
      const e = stored as TrueForgeApi.ToolResponseEvent;
      const call = state.toolCalls.get(e.toolCallId);
      if (call) {
        call.status = 'completed';
        call.result = e.content;
        call.completedAt = at;
      }
      push(state, {
        id: e.id,
        at,
        kind: 'tool_result',
        threadId: e.threadId ?? null,
        label: call ? `${call.name} returned` : 'Tool returned',
        detail: preview(e.content, 160),
        toolCallId: e.toolCallId,
      });
      return state;
    }

    case 'thread.created': {
      const e = stored as TrueForgeApi.ThreadCreatedEvent;
      const parentThreadId = e.parent?.threadId ?? null;
      const isRoot = !parentThreadId;
      if (isRoot && !state.rootThreadId) state.rootThreadId = e.threadId;

      state.threads.set(e.threadId, {
        id: e.threadId,
        title: e.title || (isRoot ? 'sentinel-agent' : 'subagent'),
        kind: isRoot ? 'root' : 'subagent',
        agentName: e.agentInfo?.name ?? null,
        input: e.agentInfo?.input ?? null,
        parentToolCallId: e.parent?.toolCallId ?? null,
        status: 'running',
        startedAt: at,
        completedAt: null,
      });

      if (!isRoot) {
        push(state, {
          id: e.id,
          at,
          kind: 'subagent_started',
          threadId: e.threadId,
          label: `${e.agentInfo?.name ?? e.title ?? 'subagent'} dispatched`,
          detail: e.agentInfo?.input ? preview(e.agentInfo.input, 160) : null,
          toolCallId: e.parent?.toolCallId ?? null,
        });
      }
      return state;
    }

    case 'thread.done': {
      const e = stored as TrueForgeApi.ThreadDoneEvent;
      const thread = state.threads.get(e.threadId);
      if (thread) {
        thread.status = 'done';
        thread.completedAt = at;
        if (thread.kind === 'subagent') {
          push(state, {
            id: e.id,
            at,
            kind: 'subagent_done',
            threadId: e.threadId,
            label: `${thread.agentName ?? thread.title} reported back`,
            detail: null,
            toolCallId: null,
          });
        }
      }
      return state;
    }

    case 'sandbox.created': {
      const e = stored as TrueForgeApi.SandboxCreatedEvent;
      state.sandboxId = e.sandboxId;
      push(state, {
        id: e.id,
        at,
        kind: 'sandbox_created',
        // Documented as always null: the sandbox is session-scoped, not per-thread.
        threadId: e.threadId ?? null,
        label: 'Isolated sandbox provisioned',
        detail: e.sandboxId,
        toolCallId: null,
      });
      return state;
    }

    case 'tool.approval_required': {
      const e = stored as TrueForgeApi.ToolApprovalRequiredEvent;
      const joined = joinApprovals(e, index);

      // Replace rather than append: a resume replays this event, and appending
      // would offer the same decision twice.
      const seen = new Set(joined.map((a) => a.toolCallId));
      state.pendingApprovals = [
        ...state.pendingApprovals.filter((a) => !seen.has(a.toolCallId)),
        ...joined,
      ];

      for (const approval of joined) {
        const call = state.toolCalls.get(approval.toolCallId);
        if (call) call.status = 'awaiting_approval';
        push(state, {
          id: `${e.id}:${approval.toolCallId}`,
          at,
          kind: 'approval_required',
          threadId: e.threadId,
          label: `Approval required — ${approval.toolName}`,
          detail: approval.resolved ? preview(approval.argsRaw, 160) : 'Details unavailable',
          toolCallId: approval.toolCallId,
        });
      }

      state.status = 'awaiting_approval';
      return state;
    }

    case 'tool.response_required': {
      // The client-executes-the-tool sibling of approval. Not used by
      // sentinel-agent — every tool is server-side — but surfaced rather than
      // swallowed, because silently ignoring it would hang the turn with no
      // visible reason.
      const e = stored as TrueForgeApi.ToolResponseRequiredEvent;
      state.status = 'awaiting_approval';
      push(state, {
        id: e.id,
        at,
        kind: 'approval_required',
        threadId: e.threadId ?? null,
        label: 'Client-side tool response required',
        detail: 'sentinel-agent does not implement client-side tools; the turn is blocked.',
        toolCallId: null,
      });
      return state;
    }

    case 'mcp.auth_required': {
      const e = stored as TrueForgeApi.McpAuthRequiredEvent;
      state.mcpAuthRequired = (e.mcpServers ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        authUrl: s.authUrl,
      }));
      push(state, {
        id: e.id,
        at,
        kind: 'mcp_auth_required',
        threadId: e.threadId ?? null,
        label: `MCP authorisation required — ${state.mcpAuthRequired.map((s) => s.name).join(', ')}`,
        detail: null,
        toolCallId: null,
      });
      return state;
    }

    case 'mcp.initialize': {
      // Payload beyond {type,id,createdAt,threadId} is undocumented, so nothing
      // is read off it. Recorded in the index; deliberately not shown.
      return state;
    }

    case 'turn.done': {
      const e = stored as TrueForgeApi.TurnDoneEvent;
      const eventState = e.state as
        | { status: string; requiredActions?: unknown[]; message?: string }
        | undefined;

      // The turn's terminal state can be `error`, not only `done` or a paused
      // `done` with pending actions — a mid-turn model-provider failure (a rate
      // limit, an exhausted credit balance) ends the turn this way. The prior
      // version of this reducer only ever distinguished "still blocked" from
      // "finished", so an errored turn rendered identically to a clean success:
      // the status bar said "Complete" in green over a run that had in fact
      // failed partway through. An operator reading that would trust a result
      // that was never actually produced — the one failure mode this reducer
      // exists to prevent.
      if (eventState?.status === 'error') {
        state.status = 'error';
        state.error = eventState.message ?? 'The turn ended in an error with no message.';
        // The turn is dead, so any approval still marked pending is now a
        // decision with nowhere to go — the session that would receive it has
        // already ended in error. Left uncleared, the UI would keep offering
        // Approve/Decline on a turn that no longer exists, and clicking either
        // would fail against a session with no live turn to resume.
        state.pendingApprovals = [];
        // A distinct kind, not `turn_done` with a different label: `turn_done`
        // renders with the timeline's green "DONE" tag, which would put the
        // exact same success signal on a failed run that this fix exists to
        // remove.
        push(state, {
          id: e.id,
          at,
          kind: 'turn_error',
          threadId: e.threadId ?? null,
          label: 'Turn failed',
          detail: state.error,
          toolCallId: null,
        });
        return state;
      }

      const required = eventState?.requiredActions;

      // A paused turn also reports `done` — the distinction is whether anything
      // is still required. Treating `done` as finished here would clear the
      // approval gate the instant it appeared.
      const stillBlocked = Array.isArray(required) && required.length > 0;
      state.status = stillBlocked ? 'awaiting_approval' : 'done';

      if (!stillBlocked) {
        state.pendingApprovals = [];
        push(state, {
          id: e.id,
          at,
          kind: 'turn_done',
          threadId: e.threadId ?? null,
          label: 'Turn complete',
          detail: null,
          toolCallId: null,
        });
      }
      return state;
    }

    default: {
      // Unknown event type from a newer harness. Indexed, not rendered.
      return state;
    }
  }
};

/** Approvals whose tool call has not already completed or been denied. */
export const activeApprovals = (state: RunState): PendingApproval[] => {
  return state.pendingApprovals.filter((approval) => {
    const call = state.toolCalls.get(approval.toolCallId);
    return !call || call.status === 'awaiting_approval';
  });
};

/** Subagent threads, root excluded, in dispatch order. */
export const subagents = (state: RunState) => {
  return [...state.threads.values()]
    .filter((t) => t.kind === 'subagent')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
};
