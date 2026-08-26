'use client';

/**
 * Right-hand agent control panel: current state, subagents, tool activity.
 *
 * Everything here is derived from harness events. The subagent list in
 * particular is read from `thread.created` / `thread.done` rather than from any
 * frontend expectation of how many subagents there should be — if the model
 * dispatches two instead of three, this shows two.
 */

import { AuditTrail } from '@/components/AuditTrail';
import type { EstateSnapshot } from '@/hooks/useEstate';
import type { RunState, ThreadView, ToolCallView } from '@/lib/trueforge/types';

interface ControlPanelProps {
  state: RunState;
  subagents: ThreadView[];
  estate: EstateSnapshot;
}

export function ControlPanel({ state, subagents, estate }: ControlPanelProps) {
  const calls = [...state.toolCalls.values()];
  const completed = calls.filter((c) => c.status === 'completed').length;
  const gated = calls.filter((c) => c.status === 'awaiting_approval').length;
  const done = subagents.filter((s) => s.status === 'done').length;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-px border-line border-t bg-surface lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-l">
      <Block title="state">
        <dl className="flex flex-col gap-2">
          <Row label="status" value={state.status.replace(/_/g, ' ')} />
          <Row
            label="sandbox"
            value={state.sandboxId ? 'provisioned' : 'not needed yet'}
            tone={state.sandboxId ? 'text-ok' : 'text-dim'}
          />
          <Row label="tool calls" value={`${completed} / ${calls.length} complete`} />
          {gated > 0 && <Row label="gated" value={`${gated} awaiting you`} tone="text-gate" />}
        </dl>
      </Block>

      <Block title={`subagents ${subagents.length > 0 ? `· ${done}/${subagents.length}` : ''}`}>
        {subagents.length === 0 ? (
          <p className="text-dim text-xs">
            None dispatched. The agent delegates only when an investigation needs parallel lines of
            enquiry.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {subagents.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    s.status === 'done' ? 'bg-ok' : 'bg-steel breathe'
                  }`}
                />
                <div className="min-w-0">
                  <p className="truncate font-mono text-ink text-xs">{s.agentName ?? s.title}</p>
                  {s.input && (
                    <p className="mt-0.5 line-clamp-2 text-[0.7rem] text-dim leading-snug">
                      {s.input}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="tool activity">
        {calls.length === 0 ? (
          <p className="text-dim text-xs">No tools reached yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {calls.slice(-12).map((c) => (
              <ToolRow key={c.id} call={c} />
            ))}
          </ul>
        )}
      </Block>

      <Block title="estate audit — what actually changed">
        <AuditTrail entries={estate.audit} error={estate.error} loading={estate.loading} />
      </Block>

      {state.mcpAuthRequired.length > 0 && (
        <Block title="mcp authorisation">
          <ul className="flex flex-col gap-2">
            {state.mcpAuthRequired.map((s) => (
              <li key={s.id} className="text-xs">
                <span className="text-danger">{s.name}</span>
                <a
                  href={s.authUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-steel underline"
                >
                  authorise
                </a>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {state.error && (
        <Block title="error">
          {/* `break-words` is load-bearing, not decorative: harness error
              messages routinely embed a long unspaced URL (an OpenRouter
              credits-management link, in practice), and this panel is only
              320px wide at `lg`+. Without it that one token forces the whole
              page into horizontal scroll instead of wrapping inside the
              column that was built to hold it. */}
          <p className="break-words text-danger text-xs leading-relaxed">{state.error}</p>
        </Block>
      )}
    </aside>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line border-b p-4">
      <h3 className="eyebrow mb-2.5">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-dim text-xs">{label}</dt>
      <dd className={`text-right font-mono text-xs ${tone}`}>{value}</dd>
    </div>
  );
}

const STATUS_TONE: Record<ToolCallView['status'], string> = {
  requested: 'bg-steel-dim',
  awaiting_approval: 'bg-gate',
  denied: 'bg-danger',
  running: 'bg-steel breathe',
  completed: 'bg-ok',
};

function ToolRow({ call }: { call: ToolCallView }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-1 shrink-0 rounded-full ${STATUS_TONE[call.status]}`}
      />
      <code className="min-w-0 flex-1 truncate font-mono text-[0.7rem] text-muted">
        {call.name}
      </code>
      <span className="shrink-0 text-[0.62rem] text-dim">
        {call.status === 'completed' ? 'ok' : call.status.replace(/_/g, ' ')}
      </span>
    </li>
  );
}
