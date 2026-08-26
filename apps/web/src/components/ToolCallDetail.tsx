'use client';

/**
 * Expandable detail for one tool call.
 *
 * This component exists because of the hackathon's qualification rule: a judge
 * has to be able to *see* the harness reaching a tool, running code in the
 * sandbox, and stopping for a person. A timeline row truncated at 160 characters
 * proves none of that. So every tool call opens to show its full arguments and
 * its full response, verbatim.
 *
 * The sandbox is special-cased. TrueForge exposes sandbox execution as a single
 * `exec` tool on a built-in server, whose arguments are
 * `{ intent, command, cwd?, env? }` — meaning **the `command` field is the code
 * the model generated**. There is no separate "sandbox command" event to render,
 * so this is the only place that code is visible, and it gets a code block rather
 * than being buried in a JSON blob.
 *
 * `env` is never rendered. The sandbox receives environment variables, and while
 * TrueForge is careful not to put credentials there, printing an env map into the
 * DOM of a page that will be screen-recorded for a demo video is a bad habit
 * regardless of who filled it in.
 */

import { useState } from 'react';

import type { ToolCallView } from '@/lib/trueforge/types';

/** Sandbox exec arguments, as documented in TrueForge's `sandboxExecSchema`. */
interface ExecArgs {
  intent?: string;
  command?: string;
  cwd?: string;
}

function isExecArgs(name: string, args: unknown): args is ExecArgs {
  return name === 'exec' && typeof args === 'object' && args !== null;
}

function pretty(value: unknown, raw: string): string {
  if (value === null) return raw;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return raw;
  }
}

/**
 * Tool responses are JSON strings. Pretty-print when possible; a 61-row CSV
 * embedded in a JSON field is unreadable as one line.
 */
function prettyResult(result: string): string {
  try {
    return JSON.stringify(JSON.parse(result) as unknown, null, 2);
  } catch {
    return result;
  }
}

export function ToolCallDetail({ call }: { call: ToolCallView }) {
  const [open, setOpen] = useState(false);
  const exec = isExecArgs(call.name, call.args) ? call.args : null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 font-mono text-[0.65rem] text-dim transition-colors hover:text-steel"
      >
        <span aria-hidden="true" className="inline-block w-2">
          {open ? '−' : '+'}
        </span>
        {open ? 'hide' : exec ? 'show generated code and output' : 'show arguments and response'}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2 border-line-strong border-l pl-3">
          {exec ? <ExecBody exec={exec} /> : <ArgsBody call={call} />}

          <Field
            label={call.result === null ? 'response — pending' : 'response'}
            body={call.result === null ? 'Still running.' : prettyResult(call.result)}
            muted={call.result === null}
          />

          <p className="font-mono text-[0.6rem] text-dim">
            {call.kind === 'mcp' && call.serverName ? `mcp · ${call.serverName} · ` : 'built-in · '}
            {call.id}
            {call.completedAt ? ` · ${durationOf(call.requestedAt, call.completedAt)}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

function ExecBody({ exec }: { exec: ExecArgs }) {
  return (
    <>
      {exec.intent && (
        <div>
          <span className="eyebrow">intent</span>
          <p className="mt-0.5 text-muted text-xs leading-relaxed">{exec.intent}</p>
        </div>
      )}
      <Field
        label={`generated code${exec.cwd ? ` · run in ${exec.cwd}` : ''}`}
        body={exec.command ?? '(no command)'}
        accent
      />
    </>
  );
}

function ArgsBody({ call }: { call: ToolCallView }) {
  if (!call.argsRaw.trim()) {
    return <p className="text-dim text-xs">No arguments.</p>;
  }
  return <Field label="arguments" body={pretty(call.args, call.argsRaw)} />;
}

function Field({
  label,
  body,
  accent = false,
  muted = false,
}: {
  label: string;
  body: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <pre
        className={`mt-1 max-h-80 overflow-auto border p-2.5 font-mono text-[0.7rem] leading-relaxed ${
          accent ? 'border-steel-dim bg-steel/[0.05] text-ink' : 'border-line bg-surface'
        } ${muted ? 'text-dim' : accent ? '' : 'text-muted'}`}
      >
        {body}
      </pre>
    </div>
  );
}

function durationOf(from: string, to: string): string {
  const ms = Date.parse(to) - Date.parse(from);
  if (!Number.isFinite(ms) || ms < 0) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
