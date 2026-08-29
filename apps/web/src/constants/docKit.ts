/** Color and label per `Callout` tone, keyed by the `tone` prop. */
export const CALLOUT_TONE = {
  note: { color: 'var(--color-steel)', label: 'Note' },
  gate: { color: 'var(--color-gate)', label: 'The gate' },
  warn: { color: 'var(--color-danger)', label: 'Careful' },
  honest: { color: 'var(--color-muted)', label: 'Honest limitation' },
  win: { color: 'var(--color-ok)', label: 'Verified' },
} as const;
