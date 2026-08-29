'use client';

import { useState } from 'react';

/**
 * A runnable command with a copy button.
 *
 * Docs that show commands you cannot copy are docs that get retyped wrong, so
 * every command in the tour is one of these rather than a plain code fence.
 */
export const CopyCommand = ({ command, comment }: { command: string; comment?: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is permission-gated and can simply refuse. The command is
      // still on screen and selectable, so this is not worth an error state.
    }
  };

  return (
    <div className="group my-4 overflow-hidden rounded-lg border border-line bg-[#0d1216]">
      {comment ? (
        <div className="border-line border-b bg-surface px-4 py-2 font-mono text-[11px] text-dim">
          {comment}
        </div>
      ) : null}
      <div className="flex items-start gap-3 px-4 py-3">
        <span aria-hidden className="select-none pt-px font-mono text-steel text-sm">
          $
        </span>
        <code className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] text-ink leading-relaxed">
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded border border-line px-2 py-1 font-mono text-[10px] text-dim uppercase tracking-wider transition hover:border-steel hover:text-steel"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
    </div>
  );
};
