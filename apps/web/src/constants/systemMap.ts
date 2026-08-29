export type SystemMapBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string[];
  accent?: string;
  fill?: string;
};

export type SystemMapEdge = { x1: number; y1: number; x2: number; y2: number; label?: string };

/** The boxes drawn on the SystemMap diagram: what runs where. */
export const SYSTEM_MAP_BOXES: SystemMapBox[] = [
  {
    x: 190,
    y: 8,
    w: 400,
    h: 62,
    title: 'sentinel-agent UI',
    sub: [
      'Next.js 16 · React 19 · 127.0.0.1:3000, loopback only',
      'A view over harness events. Holds no agent logic.',
    ],
    accent: 'var(--color-steel)',
  },
  {
    x: 230,
    y: 100,
    w: 320,
    h: 54,
    title: '/tf/[...path] route handler',
    sub: [
      'Attaches TRUEFORGE_TOKEN server-side · streams SSE',
      'Refuses cross-origin and untokened mutations',
    ],
  },
  {
    x: 40,
    y: 184,
    w: 700,
    h: 76,
    title: 'TRUEFORGE HARNESS · localhost:8790',
    sub: [
      'Agent loop · tool routing · approval gating · subagent delegation',
      'Sandbox orchestration · session persistence · context management',
    ],
    accent: 'var(--color-gate)',
    fill: 'color-mix(in oklab, var(--color-gate) 7%, var(--color-surface))',
  },
  {
    x: 40,
    y: 296,
    w: 218,
    h: 64,
    title: 'sentinel-ops MCP :8940',
    sub: ['7 read-only · 1 write GATED', '2 destructive GATED'],
  },
  {
    x: 281,
    y: 296,
    w: 218,
    h: 64,
    title: 'Subagents (dynamic)',
    sub: ['perf / deploy / code', 'isolated contexts, conclusions only'],
  },
  {
    x: 522,
    y: 296,
    w: 218,
    h: 64,
    title: 'Sandbox · Python 3.13',
    sub: ['pandas, requests, pydantic', 'no credential ever enters it'],
  },
];

/** The arrows connecting SystemMap boxes. */
export const SYSTEM_MAP_EDGES: SystemMapEdge[] = [
  { x1: 390, y1: 70, x2: 390, y2: 98 },
  { x1: 390, y1: 154, x2: 390, y2: 182, label: 'HTTP + SSE' },
  { x1: 149, y1: 260, x2: 149, y2: 294, label: 'MCP' },
  { x1: 390, y1: 260, x2: 390, y2: 294, label: 'create_sub_agent' },
  { x1: 631, y1: 260, x2: 631, y2: 294, label: 'exec' },
];
