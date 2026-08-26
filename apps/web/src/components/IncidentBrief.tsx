'use client';

/**
 * Incident header: what is wrong, on which service, and what is currently live.
 *
 * Fed from the estate's own API rather than from anything the agent said. That
 * distinction is the point — this panel is ground truth, and the timeline beside
 * it is the agent's account. When the agent claims it rolled back `dpl-4c21`,
 * this header independently shows which deployment is live now.
 *
 * Presentational — data comes from `useEstate` via the parent, which re-reads
 * after a run reaches a terminal state so a recovery is visible here as a state
 * change rather than only as a claim in the transcript.
 */

import type { EstateState } from '@/lib/estate';

const SEVERITY_TONE: Record<string, string> = {
  'SEV-1': 'text-danger',
  'SEV-2': 'text-gate',
  'SEV-3': 'text-steel',
  'SEV-4': 'text-muted',
};

const STATUS_TONE: Record<string, string> = {
  open: 'text-danger',
  investigating: 'text-gate',
  mitigated: 'text-ok',
  resolved: 'text-ok',
  degraded: 'text-danger',
  healthy: 'text-ok',
  down: 'text-danger',
};

interface IncidentBriefProps {
  state: EstateState | null;
  error: string | null;
}

export function IncidentBrief({ state, error }: IncidentBriefProps) {
  if (error) {
    return (
      <div className="border-danger/30 border-b bg-danger/5 px-5 py-3">
        <span className="eyebrow text-danger">estate unavailable</span>
        <p className="mt-1 text-danger text-xs">{error}</p>
      </div>
    );
  }

  const incident = state?.incidents[0];
  if (!incident || !state) {
    return (
      <div className="border-line border-b px-5 py-3">
        <span className="eyebrow">loading estate…</span>
      </div>
    );
  }

  const { health, live_deployment: live } = state;

  return (
    <div className="shrink-0 border-line border-b bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-3.5">
        <div className="flex items-baseline gap-2.5">
          <span className="tnum font-mono font-medium text-dim text-xs">{incident.id}</span>
          <h1 className="font-medium text-base text-ink">{incident.title}</h1>
          <span
            className={`font-mono text-[0.65rem] tracking-wider ${SEVERITY_TONE[incident.severity] ?? 'text-muted'}`}
          >
            {incident.severity}
          </span>
        </div>
        <span
          className={`font-mono text-[0.65rem] tracking-wider uppercase ${STATUS_TONE[incident.status] ?? 'text-muted'}`}
        >
          {incident.status}
        </span>
      </div>

      <p className="max-w-3xl px-5 pt-1.5 text-muted text-xs leading-relaxed">{incident.summary}</p>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-3">
        <Fact label="service" value={incident.service} />
        <Fact
          label="health"
          value={
            health
              ? `${health.status} · ${health.replicas_ready}/${health.replicas_desired} ready`
              : '—'
          }
          tone={health ? (STATUS_TONE[health.status] ?? 'text-ink') : 'text-dim'}
        />
        <Fact label="live deployment" value={live ? `${live.id} · ${live.version}` : '—'} mono />
        <Fact label="deployed" value={live ? clock(live.deployed_at) : '—'} mono />
        <Fact label="detected" value={clock(incident.detected_at)} mono />
        <Fact label="source" value={incident.detected_by} mono />
      </dl>

      {health?.checks.some((c) => !c.ok) && (
        <ul className="flex flex-col gap-1 border-line border-t px-5 py-2.5">
          {health.checks
            .filter((c) => !c.ok)
            .map((c) => (
              <li key={c.name} className="flex items-baseline gap-2 text-xs">
                <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-danger" />
                <span className="font-mono text-danger">{c.name}</span>
                <span className="text-dim">{c.detail}</span>
              </li>
            ))}
        </ul>
      )}

      {incident.notes.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-line border-t px-5 py-2.5">
          {incident.notes.map((note) => (
            <li key={`${note.at}:${note.author}`} className="text-xs">
              <span className="font-mono text-[0.65rem] text-dim">
                {clock(note.at)} · {note.author}
              </span>
              <p className="mt-0.5 text-muted leading-relaxed">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fact({
  label,
  value,
  tone = 'text-ink',
  mono = false,
}: {
  label: string;
  value: string;
  tone?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="eyebrow">{label}</dt>
      <dd className={`text-xs ${mono ? 'tnum font-mono' : ''} ${tone}`}>{value}</dd>
    </div>
  );
}

function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(11, 19);
}
