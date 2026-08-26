'use client';

/**
 * The execution timeline.
 *
 * The strongest evidence that the harness — not the frontend — is doing the work,
 * so it stays close to the event stream: every row is one event, labelled by
 * kind, with its own timestamp. Nothing here is synthesised or inferred.
 *
 * Tool-call rows carry an expandable detail panel showing full arguments and the
 * full response, because the hackathon's qualification rule is that a judge must
 * be able to *see* the harness reaching a tool and running code — which a
 * truncated preview does not demonstrate.
 *
 * `tool_result` rows are deliberately **not** rendered. The response is already
 * on the tool-call row's detail panel, keyed by the same `toolCallId`, and
 * emitting both produced two rows saying the same thing with the useful half
 * split across them. The event is still recorded in state and in the index; this
 * is a display decision, not a data one.
 *
 * Subagent rows are indented against a rail, so parallel investigation reads as
 * structure rather than interleaved noise.
 */

import { ToolCallDetail } from '@/components/ToolCallDetail';
import type { TimelineEntry, TimelineKind, ToolCallView } from '@/lib/trueforge/types';

const KIND_META: Record<TimelineKind, { tag: string; tone: string }> = {
  turn_started: { tag: 'START', tone: 'text-steel' },
  plan: { tag: 'PLAN', tone: 'text-steel' },
  message: { tag: 'AGENT', tone: 'text-muted' },
  tool_call: { tag: 'TOOL', tone: 'text-steel' },
  tool_result: { tag: 'RESULT', tone: 'text-dim' },
  subagent_started: { tag: 'DISPATCH', tone: 'text-steel' },
  subagent_done: { tag: 'REPORT', tone: 'text-ok' },
  sandbox_created: { tag: 'SANDBOX', tone: 'text-steel' },
  approval_required: { tag: 'GATE', tone: 'text-gate' },
  mcp_auth_required: { tag: 'AUTH', tone: 'text-danger' },
  turn_done: { tag: 'DONE', tone: 'text-ok' },
};

function clockOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toISOString().slice(11, 19);
}

interface TimelineProps {
  entries: TimelineEntry[];
  rootThreadId: string | null;
  toolCalls: Map<string, ToolCallView>;
}

export function Timeline({ entries, rootThreadId, toolCalls }: TimelineProps) {
  const visible = entries.filter((e) => e.kind !== 'tool_result');

  if (visible.length === 0) {
    return (
      <div className="gridfield flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="font-medium text-ink text-lg">
            The agent can investigate. You decide when it acts.
          </h2>
          <p className="mt-2 text-dim text-sm leading-relaxed">
            Hand sentinel-agent an incident. It reaches real systems, delegates parallel lines of
            enquiry, computes the magnitudes in a sandbox, and then stops — holding any change to
            production until you authorise it.
          </p>
          <p className="mt-4 font-mono text-[0.65rem] text-dim tracking-wider uppercase">
            real tools · sandboxed code · subagents · human approval
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className="flex flex-col">
      {visible.map((entry) => {
        const meta = KIND_META[entry.kind];
        const isSub = entry.threadId !== null && entry.threadId !== rootThreadId;
        const call = entry.toolCallId ? toolCalls.get(entry.toolCallId) : undefined;
        const showDetail = entry.kind === 'tool_call' && call !== undefined;

        return (
          <li
            key={`${entry.id}:${entry.kind}`}
            className="grid grid-cols-[4.5rem_5.5rem_1fr] gap-3 border-line/60 border-b px-5 py-2.5 hover:bg-surface/40"
          >
            <time className="tnum pt-px font-mono text-[0.7rem] text-dim" dateTime={entry.at}>
              {clockOf(entry.at)}
            </time>

            <span className={`pt-px font-mono text-[0.62rem] tracking-[0.12em] ${meta.tone}`}>
              {meta.tag}
            </span>

            <div className={`min-w-0 ${isSub ? 'border-line-strong border-l pl-3' : ''}`}>
              <div className="flex items-baseline gap-2">
                <p
                  className={`min-w-0 text-sm ${
                    entry.kind === 'approval_required'
                      ? 'font-medium text-gate'
                      : entry.kind === 'message'
                        ? 'text-muted'
                        : 'text-ink'
                  }`}
                >
                  {entry.label}
                </p>
                {call && <StatusChip call={call} />}
              </div>

              {entry.detail && !showDetail && (
                <p className="mt-1 break-all font-mono text-[0.7rem] text-dim leading-relaxed">
                  {entry.detail}
                </p>
              )}

              {showDetail && <ToolCallDetail call={call} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const CHIP: Record<ToolCallView['status'], { label: string; className: string }> = {
  requested: { label: 'running', className: 'border-steel-dim text-steel' },
  awaiting_approval: { label: 'awaiting approval', className: 'border-gate/50 text-gate' },
  denied: { label: 'declined', className: 'border-danger/50 text-danger' },
  running: { label: 'running', className: 'border-steel-dim text-steel' },
  completed: { label: 'ok', className: 'border-ok/40 text-ok' },
};

function StatusChip({ call }: { call: ToolCallView }) {
  const chip = CHIP[call.status];
  return (
    <span
      className={`shrink-0 border px-1.5 py-px font-mono text-[0.58rem] tracking-wider uppercase ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}
