import type { RunStatus } from '@/lib/trueforge/types';

const STATUS_COPY: Record<RunStatus, { label: string; tone: string; live: boolean }> = {
  idle: { label: 'Standing by', tone: 'text-dim', live: false },
  starting: { label: 'Opening session', tone: 'text-steel', live: true },
  running: { label: 'Investigating', tone: 'text-steel', live: true },
  awaiting_approval: {
    label: 'Holding for approval',
    tone: 'text-gate',
    live: true,
  },
  done: { label: 'Complete', tone: 'text-ok', live: false },
  cancelled: { label: 'Cancelled', tone: 'text-muted', live: false },
  error: { label: 'Failed', tone: 'text-danger', live: false },
};

interface TopBarProps {
  status: RunStatus;
  sessionId: string | null;
  sandboxId: string | null;
  toolCallCount: number;
}

export function TopBar({ status, sessionId, sandboxId, toolCallCount }: TopBarProps) {
  const s = STATUS_COPY[status];

  return (
    <header className="flex shrink-0 items-center justify-between border-line border-b bg-surface px-5 py-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono font-medium text-ink text-sm tracking-tight">
          sentinel-agent
        </span>
        <span className="eyebrow hidden sm:inline">incident response</span>
      </div>

      <div className="flex items-center gap-5">
        <Stat label="session" value={sessionId ? sessionId.slice(0, 12) : '—'} />
        <Stat label="sandbox" value={sandboxId ? sandboxId.slice(0, 10) : 'not provisioned'} />
        <Stat label="tool calls" value={String(toolCallCount)} />

        <div className="flex items-center gap-2 border-line border-l pl-5">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${
              status === 'awaiting_approval'
                ? 'bg-gate'
                : status === 'error'
                  ? 'bg-danger'
                  : status === 'done'
                    ? 'bg-ok'
                    : status === 'idle' || status === 'cancelled'
                      ? 'bg-dim'
                      : 'bg-steel'
            } ${s.live ? 'breathe' : ''}`}
          />
          <span className={`font-medium text-xs ${s.tone}`}>{s.label}</span>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden flex-col gap-0.5 md:flex">
      <span className="eyebrow">{label}</span>
      <span className="tnum font-mono text-[0.7rem] text-muted">{value}</span>
    </div>
  );
}
