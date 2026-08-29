/**
 * Product panels for the marketing page.
 *
 * These are illustrations of the real console, not screenshots of it: the
 * console needs a running harness, a model key and a live incident before it
 * shows anything at all. Every value in them is taken from the seeded estate,
 * so nothing here shows a number the product cannot actually produce.
 */

import {
  MOCK_APPROVAL_BRIEF,
  MOCK_DOCTOR_LINES,
  MOCK_SANDBOX_CODE,
  MOCK_TIMELINE_EVENTS,
  MOCK_TIMELINE_KIND_COLOR,
} from '@/constants/panels';

const Panel = ({ children, label }: { children: React.ReactNode; label: string }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2 border-line border-b bg-raised px-4 py-2.5">
        <span className="flex gap-1.5">
          <Dot />
          <Dot />
          <Dot />
        </span>
        <span className="ml-2 font-mono text-[11px] text-dim">{label}</span>
      </div>
      {children}
    </div>
  );
};

const Dot = () => <span className="h-2 w-2 rounded-full bg-line-strong" />;

/* ---------------------------------------------------------------- timeline */

export const TimelineMock = () => {
  return (
    <Panel label="sentinel-agent — run · INC-2048">
      <div className="divide-y divide-line">
        {MOCK_TIMELINE_EVENTS.map((e) => (
          <div key={`${e.t}-${e.name}`} className="flex min-w-0 items-center gap-3 px-4 py-2.5">
            <span className="tnum shrink-0 font-mono text-[11px] text-dim">{e.t}</span>
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: MOCK_TIMELINE_KIND_COLOR[e.kind] }}
            />
            <span
              className="shrink-0 font-mono text-[12.5px]"
              style={{ color: e.kind === 'gate' ? 'var(--color-gate)' : 'var(--color-ink)' }}
            >
              {e.name}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-dim">
              {e.arg}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-dim uppercase tracking-wider">
              {e.state === 'gate' ? 'awaiting you' : e.state === 'run' ? 'running' : 'done'}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
};

/* -------------------------------------------------------------------- gate */

export const GateMock = () => {
  return (
    <Panel label="approval required — thread thr_9f2a">
      <div className="border-gate/40 border-l-2 bg-[color-mix(in_oklab,var(--color-gate)_6%,transparent)] p-5">
        <div className="flex items-center gap-2">
          <span className="breathe h-1.5 w-1.5 rounded-full bg-gate" />
          <span className="font-mono text-[11px] text-gate uppercase tracking-[0.14em]">
            held — the agent has stopped
          </span>
        </div>

        <h4 className="mt-3 font-mono text-[15px] text-ink">
          rollback_deployment(<span className="text-gate">dpl-4c21</span>)
        </h4>

        <dl className="mt-4 space-y-2 text-[12.5px]">
          {MOCK_APPROVAL_BRIEF.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-3">
              <dt className="text-dim">{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-md bg-gate px-4 py-2 font-medium text-[#231803] text-[13px]">
            Approve
          </span>
          <span className="rounded-md border border-line px-4 py-2 text-[13px] text-muted">
            Deny
          </span>
          <span className="ml-auto self-center font-mono text-[11px] text-dim">
            nothing happens until you choose
          </span>
        </div>
      </div>
    </Panel>
  );
};

/* ----------------------------------------------------------------- sandbox */

export const SandboxMock = () => {
  return (
    <Panel label="sandbox · python 3.13 · no credentials">
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[11.5px] text-muted leading-[1.7]">
        <code>{MOCK_SANDBOX_CODE}</code>
      </pre>
      <div className="border-line border-t bg-[#0d1216] px-4 py-3 font-mono text-[11.5px]">
        <div className="text-dim">stdout</div>
        <div className="mt-1 text-ok">177.9 658.2 3.7000</div>
        <div className="text-ok">0.99908</div>
        <div className="mt-2 text-muted">
          The magnitude is <span className="text-ink">computed</span>, not estimated. Throughput
          unchanged, so this is not a traffic surge.
        </div>
      </div>
    </Panel>
  );
};

/* ---------------------------------------------------------------- terminal */

export const DoctorMock = () => {
  return (
    <Panel label="npm run doctor">
      <div className="overflow-x-auto px-4 py-4 font-mono text-[11.5px] leading-[1.9]">
        {MOCK_DOCTOR_LINES.map(([k, v, s]) => (
          <div key={k} className="flex gap-2">
            <span style={{ color: s === 'ok' ? 'var(--color-ok)' : 'var(--color-gate)' }}>✓</span>
            <span className="w-[180px] shrink-0 text-ink">{k}</span>
            <span className="truncate text-dim">{v}</span>
          </div>
        ))}
        <div className="mt-3 text-steel">Ready to run. 1 warning above.</div>
      </div>
    </Panel>
  );
};
