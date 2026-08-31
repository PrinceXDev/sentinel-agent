/**
 * The film's visual system, taken directly from the product.
 *
 * These are the same tokens `apps/web/src/app/globals.css` defines, including
 * the rule that matters most: **amber appears in exactly one place** — the
 * approval gate. Nothing else in the film may use it. That is what makes the
 * moment the agent stops and asks visually unique rather than one alert among
 * many, and it is the whole point of the product.
 */

export const COLORS = {
  ground: '#0a0d11',
  surface: '#12171d',
  raised: '#171f27',
  line: '#202a33',
  lineStrong: '#2c3946',

  ink: '#e4e9ed',
  muted: '#8695a3',
  dim: '#5d6b78',

  /** Restrained brand accent. Not a status colour. */
  steel: '#5b9dbf',
  steelDim: '#2f5568',

  ok: '#4fb286',
  danger: '#d4614e',

  /** Reserved for the approval gate. Do not use elsewhere. */
  gate: '#e0a33e',
  gateDim: '#4a3717',

  /** The reviewer's voice — deliberately not the brand accent. */
  audit: '#8b7fd4',
  auditDim: '#322b52',

  /** Instructions found in estate content. The input is the threat. */
  threat: '#d4519a',
  threatDim: '#4a1c35',
} as const;

export const FONTS = {
  sans: 'IBMPlexSans, system-ui, sans-serif',
  mono: 'IBMPlexMono, ui-monospace, Consolas, monospace',
} as const;

/** One scale, used everywhere, so nothing is sized by eye. */
export const TYPE = {
  hero: 132,
  headline: 78,
  title: 56,
  lead: 40,
  body: 30,
  small: 24,
  eyebrow: 20,
  micro: 17,
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

/** Uppercase micro-label, matching the product's `.eyebrow` class. */
export const eyebrowStyle: React.CSSProperties = {
  fontFamily: FONTS.mono,
  fontSize: TYPE.eyebrow,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: COLORS.dim,
};
