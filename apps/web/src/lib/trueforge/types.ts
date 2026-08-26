/**
 * View model for one agent run.
 *
 * Deliberately separate from the wire types. Turn events are an append-only log
 * optimised for transport; a UI needs current state keyed by identity — "is this
 * tool call still pending", "which subagents are running". The reducer in
 * `runReducer.ts` is the only thing that converts one into the other.
 */

export type RunStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'awaiting_approval'
  | 'done'
  | 'cancelled'
  | 'error';

export type ToolCallStatus = 'requested' | 'awaiting_approval' | 'denied' | 'running' | 'completed';

export interface ToolCallView {
  readonly id: string;
  /** Tool name as the agent invoked it, e.g. `rollback_deployment` or `exec`. */
  readonly name: string;
  /** MCP server the tool belongs to, when it is an MCP tool. */
  readonly serverName: string | null;
  readonly kind: 'mcp' | 'system';
  /** Parsed arguments, or null when the JSON was incomplete or malformed. */
  readonly args: unknown;
  /** Raw argument string, kept so a malformed payload is still inspectable. */
  readonly argsRaw: string;
  readonly threadId: string;
  status: ToolCallStatus;
  /** Tool output, once `tool.response` arrives. */
  result: string | null;
  readonly requestedAt: string;
  completedAt: string | null;
}

export interface ThreadView {
  readonly id: string;
  readonly title: string;
  readonly kind: 'root' | 'subagent';
  /** Name the model gave the subagent, e.g. `performance-investigator`. */
  readonly agentName: string | null;
  /** Brief the root agent wrote for this subagent. */
  readonly input: string | null;
  /** Tool call that spawned this thread, linking it back to its parent. */
  readonly parentToolCallId: string | null;
  status: 'running' | 'done';
  readonly startedAt: string;
  completedAt: string | null;
}

/**
 * A tool call the harness has paused on, joined with the message that requested
 * it.
 *
 * The join is the whole point. `tool.approval_required` carries only
 * `{ id, source_event_id }` — no tool name, no arguments — so rendering a
 * meaningful prompt requires following `sourceEventId` back to the originating
 * `model.message` and finding the matching entry in its `toolCalls`. If that
 * lookup fails the approval is still real and still blocking, which is why
 * `toolName` falls back rather than the approval being dropped.
 */
export interface PendingApproval {
  readonly threadId: string;
  readonly toolCallId: string;
  readonly sourceEventId: string;
  readonly toolName: string;
  readonly serverName: string | null;
  readonly args: unknown;
  readonly argsRaw: string;
  /** False when the join failed, so the UI can say so rather than imply detail. */
  readonly resolved: boolean;
}

export type TimelineKind =
  | 'turn_started'
  | 'plan'
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'subagent_started'
  | 'subagent_done'
  | 'sandbox_created'
  | 'approval_required'
  | 'mcp_auth_required'
  | 'turn_done';

export interface TimelineEntry {
  /** Event id. Monotonic ULID, so insertion order is chronological. */
  readonly id: string;
  readonly at: string;
  readonly kind: TimelineKind;
  readonly threadId: string | null;
  readonly label: string;
  readonly detail: string | null;
  readonly toolCallId: string | null;
}

export interface RunState {
  status: RunStatus;
  readonly sessionId: string | null;
  readonly turnId: string | null;
  /** Resume cursor for `subscribeToTurn` after a disconnect. */
  lastSequenceNumber: number;
  /** Root thread id, established by the first `thread.created`. */
  rootThreadId: string | null;
  readonly threads: Map<string, ThreadView>;
  readonly toolCalls: Map<string, ToolCallView>;
  readonly timeline: TimelineEntry[];
  pendingApprovals: PendingApproval[];
  /** Sandbox id once provisioned. Null means the agent never needed one. */
  sandboxId: string | null;
  /** Assistant prose, accumulated across the run in arrival order. */
  messages: { id: string; threadId: string; content: string; at: string }[];
  /** MCP servers awaiting OAuth, if any. */
  mcpAuthRequired: { id: string; name: string; authUrl: string }[];
  error: string | null;
}

export function emptyRunState(): RunState {
  return {
    status: 'idle',
    sessionId: null,
    turnId: null,
    lastSequenceNumber: 0,
    rootThreadId: null,
    threads: new Map(),
    toolCalls: new Map(),
    timeline: [],
    pendingApprovals: [],
    sandboxId: null,
    messages: [],
    mcpAuthRequired: [],
    error: null,
  };
}

/** Persisted across reloads. This triple is the entire reconnect state. */
export interface RunHandle {
  readonly sessionId: string;
  readonly turnId: string;
  readonly lastSequenceNumber: number;
}
