/**
 * Design tokens, copied verbatim from apps/web/src/app/globals.css.
 *
 * Not imported directly — Remotion renders in its own bundler context,
 * separate from the Next.js app, so there is no live link to the CSS custom
 * properties. Keeping the values identical by hand is a deliberate tradeoff
 * for a submission asset this small; if the app's palette changes, this file
 * needs a matching edit, and there is exactly one place to make it.
 *
 * The one rule carried over deliberately: `gate` (amber) is reserved for the
 * approval moment in the product, and does not appear anywhere in these
 * compositions. The intro/outro use `steel` as the accent, same as everywhere
 * else in the app that isn't the approval gate.
 */
export const tokens = {
  ground: '#0a0d11',
  surface: '#12171d',
  line: '#202a33',
  lineStrong: '#2c3946',
  ink: '#e4e9ed',
  muted: '#8695a3',
  dim: '#5d6b78',
  steel: '#5b9dbf',
  steelDim: '#2f5568',
  ok: '#4fb286',
} as const;
