'use client';

/**
 * Collects the operator token.
 *
 * Shown when the server refuses a state-changing call for want of a token, not
 * as an upfront gate. Investigation is read-only and needs no credential, so
 * demanding one before anything can happen would put a login wall in front of a
 * local tool for no benefit — and would train the operator to paste the token
 * reflexively, which is the opposite of the intent.
 *
 * The value goes to `sessionStorage` and travels as an explicit header. It is
 * never a cookie: cookies are attached automatically, which is the mechanism
 * that makes CSRF possible in the first place.
 */

import { useState } from 'react';

import { saveOperatorToken } from '@/lib/operatorToken';

interface OperatorTokenPromptProps {
  /** Why the token is being asked for, taken from the server's refusal. */
  reason: string;
  onSaved: () => void;
  onDismiss: () => void;
}

export function OperatorTokenPrompt({ reason, onSaved, onDismiss }: OperatorTokenPromptProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveOperatorToken(trimmed);
    setValue('');
    onSaved();
  };

  return (
    <section
      aria-labelledby="operator-token-heading"
      className="border-danger/40 border-y bg-danger/[0.04] px-3 py-4 sm:px-5"
    >
      <h2
        id="operator-token-heading"
        className="font-medium font-mono text-danger text-xs tracking-[0.14em] uppercase"
      >
        Operator token required
      </h2>

      <p className="mt-2 max-w-prose break-words text-muted text-sm">{reason}</p>

      <p className="mt-2 max-w-prose text-dim text-xs">
        Read-only investigation needs no token. Only actions that change state — approving a
        rollback, cancelling a run — require one. Set{' '}
        <code className="text-muted">SENTINEL_UI_TOKEN</code> in{' '}
        <code className="text-muted">.env</code>, restart the dev server, and enter the same value
        here. It is held for this tab only and sent as a header, never as a cookie.
      </p>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="operator-token" className="sr-only">
          Operator token
        </label>
        <input
          id="operator-token"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste SENTINEL_UI_TOKEN"
          className="min-w-64 flex-1 border border-line bg-ground px-3 py-2 font-mono text-ink text-sm placeholder:text-dim focus:border-line-strong focus:outline-none"
        />
        <button
          type="submit"
          disabled={value.trim().length === 0}
          className="border border-steel bg-steel/10 px-4 py-2 font-medium text-sm text-steel transition-colors hover:bg-steel/20 disabled:opacity-40"
        >
          Save and retry
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-2 text-muted text-sm transition-colors hover:text-ink"
        >
          Dismiss
        </button>
      </form>
    </section>
  );
}
