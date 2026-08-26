/**
 * Reducer and approval-join tests.
 *
 * The approval join is the most defect-prone logic in this app, and the most
 * consequential: it is what turns "approve tool call `call_1`?" into "approve
 * `rollback_deployment({deployment_id: 'dpl-4c21'})`?". Getting it wrong means a
 * human authorising something they cannot see.
 *
 * These tests build events by hand rather than mocking the SDK, because the
 * thing worth testing is our handling of the documented payload shapes — a mock
 * would only assert that we agree with our own assumptions.
 *
 * Event payloads below use the SDK's camelCase surface, which is what arrives
 * after deserialisation. The wire format is snake_case; that conversion is the
 * SDK's job and not ours to re-test.
 */

import type { TrueForgeApi } from '@truefoundry/trueforge-sdk';
import { beforeEach, describe, expect, it } from 'vitest';

import { EventIndex, joinApprovals } from './eventIndex';
import { activeApprovals, reduce, subagents } from './runReducer';
import { emptyRunState, type RunState } from './types';

type Event = TrueForgeApi.TurnStreamingEvent;

const AT = '2026-08-25T15:02:00.000Z';

let state: RunState;
let index: EventIndex;

beforeEach(() => {
  state = emptyRunState();
  index = new EventIndex();
});

const apply = (...events: Event[]): void => {
  for (const event of events) reduce(state, event, index);
};

function turnCreated(id = 'ev_turn', turnId = 'turn_1'): Event {
  return { type: 'turn.created', id, turnId, createdAt: AT, state: { status: 'running' } } as Event;
}

function rootThread(threadId = 'thr_root'): Event {
  return {
    type: 'thread.created',
    id: `ev_${threadId}`,
    threadId,
    title: 'sentinel-agent',
    createdAt: AT,
  } as Event;
}

function subThread(threadId: string, name: string, toolCallId = 'call_spawn'): Event {
  return {
    type: 'thread.created',
    id: `ev_${threadId}`,
    threadId,
    title: name,
    agentInfo: { name, input: `Brief for ${name}` },
    parent: { threadId: 'thr_root', toolCallId },
    createdAt: AT,
  } as Event;
}

/** A model message announcing one tool call — where a tool call first exists. */
function messageWithToolCall(args: {
  eventId: string;
  callId: string;
  toolName: string;
  serverName?: string;
  argsJson: string;
  threadId?: string;
}): Event {
  return {
    type: 'model.message',
    id: args.eventId,
    threadId: args.threadId ?? 'thr_root',
    createdAt: AT,
    toolCalls: [
      {
        id: args.callId,
        type: 'function',
        function: { name: args.toolName, arguments: args.argsJson },
        toolInfo: args.serverName
          ? { type: 'mcp', server_name: args.serverName, name: args.toolName }
          : { type: 'truefoundry-system', name: args.toolName },
      },
    ],
  } as unknown as Event;
}

/**
 * A terminal `turn.done`.
 *
 * `requiredActions` is the field that distinguishes a finished turn from a paused
 * one — both report `status: 'done'`.
 */
function turnDone(requiredActions: { type: string }[]): Event {
  return {
    type: 'turn.done',
    id: 'ev_done',
    threadId: null,
    createdAt: AT,
    state: { status: 'done', requiredActions, completedAt: AT },
  } as unknown as Event;
}

/**
 * A terminal `turn.done` whose state carries `status: 'error'` — a mid-turn
 * model-provider failure (a rate limit, an exhausted credit balance), not the
 * absence of required actions. Distinct from `turnDone()` above.
 */
function turnErrored(message: string): Event {
  return {
    type: 'turn.done',
    id: 'ev_errored',
    threadId: null,
    createdAt: AT,
    state: { status: 'error', message, completedAt: AT },
  } as unknown as Event;
}

function approvalRequired(callId: string, sourceEventId: string, threadId = 'thr_root'): Event {
  return {
    type: 'tool.approval_required',
    id: `ev_gate_${callId}`,
    threadId,
    createdAt: AT,
    toolCalls: [{ id: callId, sourceEventId }],
  } as Event;
}

describe('turn lifecycle', () => {
  it('marks the run running and records the turn id', () => {
    apply(turnCreated());
    expect(state.status).toBe('running');
    expect(state.turnId).toBe('turn_1');
  });

  it('completes when turn.done carries no required actions', () => {
    apply(turnCreated(), turnDone([]));
    expect(state.status).toBe('done');
  });

  it('stays blocked when turn.done still reports required actions', () => {
    // A paused turn also reports `done`. Treating that as finished would clear
    // the approval gate the instant it appeared — the most damaging bug possible
    // in this reducer, since it would make the agent look approved.
    apply(turnCreated(), turnDone([{ type: 'tool.approval_required' }]));
    expect(state.status).toBe('awaiting_approval');
  });

  it('surfaces an errored turn as an error, not as a completed run', () => {
    // The terminal state a `turn.done` carries is not only "done" (optionally
    // still blocked) — it can also be "error", produced by a mid-turn
    // model-provider failure such as an exhausted credit balance. The original
    // reducer checked only for `requiredActions` and defaulted anything else to
    // `done`, so an errored turn rendered identically to a genuine success: the
    // status bar read "Complete" in green over a run that had in fact failed
    // partway through and produced no usable result.
    apply(turnCreated(), turnErrored('Request failed (402): This request requires more credits.'));
    expect(state.status).toBe('error');
    expect(state.error).toBe('Request failed (402): This request requires more credits.');
  });

  it("renders the errored turn's timeline entry as failed, not as done", () => {
    // A regression here would put the timeline's green "DONE" tag on a run that
    // failed — the exact confusion the status-level fix above exists to remove.
    apply(turnCreated(), turnErrored('boom'));
    const entry = state.timeline.at(-1);
    expect(entry?.kind).toBe('turn_error');
    expect(entry?.kind).not.toBe('turn_done');
  });

  it('falls back to a generic message when the harness sends none', () => {
    apply(turnCreated(), {
      type: 'turn.done',
      id: 'ev_errored_blank',
      threadId: null,
      createdAt: AT,
      state: { status: 'error', completedAt: AT },
    } as unknown as Event);
    expect(state.status).toBe('error');
    expect(state.error).toMatch(/error/i);
  });
});

describe('tool calls', () => {
  it('creates a tool call view from the announcing message', () => {
    apply(
      turnCreated(),
      rootThread(),
      messageWithToolCall({
        eventId: 'ev_msg',
        callId: 'call_1',
        toolName: 'get_incident',
        serverName: 'sentinel-ops',
        argsJson: '{"incident_id":"INC-2048"}',
      }),
    );

    const call = state.toolCalls.get('call_1');
    expect(call?.name).toBe('get_incident');
    expect(call?.serverName).toBe('sentinel-ops');
    expect(call?.kind).toBe('mcp');
    expect(call?.args).toEqual({ incident_id: 'INC-2048' });
    expect(call?.status).toBe('requested');
  });

  it('tolerates argument JSON that is still streaming', () => {
    apply(
      messageWithToolCall({
        eventId: 'ev_msg',
        callId: 'call_1',
        toolName: 'get_incident',
        argsJson: '{"incident_id":"INC-20',
      }),
    );
    const call = state.toolCalls.get('call_1');
    // Parsed args unavailable, but the raw string is retained so the UI can still
    // show something truthful rather than nothing.
    expect(call?.args).toBeNull();
    expect(call?.argsRaw).toBe('{"incident_id":"INC-20');
  });

  it('completes the call and stores the full response on tool.response', () => {
    apply(
      messageWithToolCall({
        eventId: 'ev_msg',
        callId: 'call_1',
        toolName: 'get_incident',
        argsJson: '{}',
      }),
      {
        type: 'tool.response',
        id: 'ev_resp',
        threadId: 'thr_root',
        toolCallId: 'call_1',
        content: '{"id":"INC-2048"}',
        createdAt: AT,
      } as Event,
    );

    const call = state.toolCalls.get('call_1');
    expect(call?.status).toBe('completed');
    expect(call?.result).toBe('{"id":"INC-2048"}');
    expect(call?.completedAt).toBe(AT);
  });

  it('does not duplicate a call when the same message is replayed', () => {
    const msg = messageWithToolCall({
      eventId: 'ev_msg',
      callId: 'call_1',
      toolName: 'get_incident',
      argsJson: '{}',
    });
    apply(msg, msg);
    expect(state.toolCalls.size).toBe(1);
    expect(state.timeline.filter((e) => e.kind === 'tool_call')).toHaveLength(1);
  });
});

describe('subagents', () => {
  it('records dispatched subagents with their briefs, root excluded', () => {
    apply(
      rootThread(),
      subThread('thr_a', 'performance-investigator'),
      subThread('thr_b', 'deployment-investigator'),
    );

    const dispatched = subagents(state);
    expect(dispatched.map((t) => t.agentName)).toEqual([
      'performance-investigator',
      'deployment-investigator',
    ]);
    expect(dispatched[0]?.input).toContain('performance-investigator');
    expect(state.rootThreadId).toBe('thr_root');
  });

  it('marks a subagent done when its thread closes', () => {
    apply(rootThread(), subThread('thr_a', 'code-investigator'), {
      type: 'thread.done',
      id: 'ev_done_a',
      threadId: 'thr_a',
      createdAt: AT,
    } as Event);

    expect(state.threads.get('thr_a')?.status).toBe('done');
  });
});

describe('sandbox', () => {
  it('records the sandbox id when one is provisioned', () => {
    apply({
      type: 'sandbox.created',
      id: 'ev_sb',
      sandboxId: 'sbx_123',
      threadId: null,
      createdAt: AT,
    } as Event);

    expect(state.sandboxId).toBe('sbx_123');
    expect(state.timeline.some((e) => e.kind === 'sandbox_created')).toBe(true);
  });
});

describe('approval join', () => {
  it('recovers the tool name and arguments through sourceEventId', () => {
    // The whole reason the event index exists. `tool.approval_required` carries
    // only {id, sourceEventId}, so without this join the prompt cannot name what
    // it is asking about.
    apply(
      turnCreated(),
      rootThread(),
      messageWithToolCall({
        eventId: 'ev_msg',
        callId: 'call_rb',
        toolName: 'rollback_deployment',
        serverName: 'sentinel-ops',
        argsJson: '{"deployment_id":"dpl-4c21","reason":"regression confirmed"}',
      }),
      approvalRequired('call_rb', 'ev_msg'),
    );

    expect(state.status).toBe('awaiting_approval');
    const pending = activeApprovals(state);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      toolName: 'rollback_deployment',
      serverName: 'sentinel-ops',
      toolCallId: 'call_rb',
      threadId: 'thr_root',
      resolved: true,
    });
    expect(pending[0]?.args).toEqual({
      deployment_id: 'dpl-4c21',
      reason: 'regression confirmed',
    });
    expect(state.toolCalls.get('call_rb')?.status).toBe('awaiting_approval');
  });

  it('still surfaces the approval when the source message is missing', () => {
    // Dropping it would be worse: the turn stays blocked either way, and an
    // approval the UI omits is one nobody can clear.
    apply(turnCreated(), approvalRequired('call_orphan', 'ev_never_seen'));

    const pending = activeApprovals(state);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.resolved).toBe(false);
    expect(pending[0]?.toolName).toBe('unknown_tool');
    expect(state.status).toBe('awaiting_approval');
  });

  it('does not offer the same approval twice when the event is replayed', () => {
    const msg = messageWithToolCall({
      eventId: 'ev_msg',
      callId: 'call_rb',
      toolName: 'rollback_deployment',
      argsJson: '{}',
    });
    const gate = approvalRequired('call_rb', 'ev_msg');
    apply(turnCreated(), msg, gate, gate);

    expect(activeApprovals(state)).toHaveLength(1);
  });

  it('yields one approval per pending tool call in a single event', () => {
    // Each pending call needs its own `user.tool_approval` item, so the join must
    // not collapse them.
    apply(
      messageWithToolCall({
        eventId: 'ev_msg',
        callId: 'call_a',
        toolName: 'post_incident_note',
        argsJson: '{}',
      }),
    );
    const multi = {
      type: 'tool.approval_required',
      id: 'ev_gate_multi',
      threadId: 'thr_root',
      createdAt: AT,
      toolCalls: [
        { id: 'call_a', sourceEventId: 'ev_msg' },
        { id: 'call_b', sourceEventId: 'ev_msg' },
      ],
    } as Event;

    const joined = joinApprovals(multi as TrueForgeApi.ToolApprovalRequiredEvent, index);
    expect(joined).toHaveLength(2);
    expect(joined[0]?.resolved).toBe(true);
    // call_b was never announced on that message, so it cannot be described.
    expect(joined[1]?.resolved).toBe(false);
  });

  it('drops an approval from the active list once its call completes', () => {
    apply(
      messageWithToolCall({
        eventId: 'ev_msg',
        callId: 'call_rb',
        toolName: 'rollback_deployment',
        argsJson: '{}',
      }),
      approvalRequired('call_rb', 'ev_msg'),
      {
        type: 'tool.response',
        id: 'ev_resp',
        threadId: 'thr_root',
        toolCallId: 'call_rb',
        content: '{"rolled_back":"dpl-4c21"}',
        createdAt: AT,
      } as Event,
    );

    expect(activeApprovals(state)).toHaveLength(0);
  });
});

describe('resilience', () => {
  it('ignores an unrecognised event type without throwing', () => {
    expect(() =>
      apply({ type: 'some.future.event', id: 'ev_x', createdAt: AT } as unknown as Event),
    ).not.toThrow();
    expect(state.status).toBe('idle');
  });

  it('surfaces MCP servers awaiting authorisation', () => {
    apply({
      type: 'mcp.auth_required',
      id: 'ev_auth',
      createdAt: AT,
      mcpServers: [{ id: 'srv_1', name: 'sentinel-ops', authUrl: 'https://example.test/oauth' }],
    } as Event);

    expect(state.mcpAuthRequired).toHaveLength(1);
    expect(state.mcpAuthRequired[0]?.name).toBe('sentinel-ops');
  });
});
