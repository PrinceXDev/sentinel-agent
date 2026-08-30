/** Content for the `/product` marketing page's hero and "platform underneath" sections. */

export const HERO_POINTS = [
  {
    title: 'Investigation runs itself',
    body: 'Five tabs of dashboards, deploy logs, diffs and arithmetic, done in one pass by an agent that reaches the real systems over MCP.',
  },
  {
    title: 'Evidence, not vibes',
    body: 'It exports 61 raw samples and computes the regression in a sandbox. The magnitude is never handed to it.',
  },
  {
    title: 'Execution stays yours',
    body: 'Every production-mutating tool pauses in the harness. The agent cannot bypass the gate, even by accident.',
  },
];

export const PLATFORM_PIECES = [
  {
    n: '01',
    title: 'The harness',
    body: 'TrueForge carries the agent loop, MCP tool routing, approval gating, subagent delegation, sandbox orchestration, session persistence and context management. Remove it and this project does not degrade — it stops existing.',
  },
  {
    n: '02',
    title: 'The tool surface',
    body: 'Thirteen MCP tools over streamable HTTP, each built through a defineTool that requires a risk class and derives its annotations from it. Eight read-only run autonomously — including a dry run that computes what a destructive call would change. Five write or destroy, and all five are gated.',
  },
  {
    n: '03',
    title: 'The sandbox',
    body: 'Python 3.13 with pandas, provisioned on demand — Daytona if configured, or TrueForge’s local provider with no external account at all. Tool calls from sandbox code are bridged back to the harness, so untrusted code cannot exfiltrate a key it never had.',
  },
  {
    n: '04',
    title: 'The credential boundary',
    body: 'Every credential lives in the harness. The UI holds none, the MCP server holds none, the sandbox holds none. The one external key this repo ever touches is read once, by provision, and handed straight over.',
  },
  {
    n: '05',
    title: 'The proof',
    body: '149 tests, annotations verified on the wire against the SDK, and a conformance suite that drives four different routes at a destructive tool and reports — honestly — which ones the harness actually stopped.',
  },
];

/**
 * The three layers that make an unannotated destructive tool impossible.
 *
 * Ordered as the homepage renders them: structural first, because it is the one
 * that removes the mistake rather than detecting it.
 */
export const GATE_LAYERS: { readonly title: string; readonly body: string }[] = [
  {
    title: 'Structural',
    body: 'Every tool is built through defineTool, which requires a risk class and derives annotations from it. No code path registers a tool without them.',
  },
  {
    title: 'Tested',
    body: "registry.test.ts asserts against the harness's own predicates rather than our labels. Add a destructive tool without classifying it and CI fails.",
  },
  {
    title: 'Belt and braces',
    body: 'The agent spec names the destructive tools literally as well as by tag, so the gate holds even if an SDK version drops annotations in transit.',
  },
];
