export type DocPage = { href: string; label: string; blurb: string };
export type DocSection = { title: string; pages: DocPage[] };

/**
 * The docs table of contents, in reading order.
 *
 * One flat ordered list underneath the section headings, so "previous / next"
 * at the foot of every page can be derived rather than hand-maintained — which
 * is how docs footers end up pointing at pages that no longer exist.
 */
export const DOCS_NAV: DocSection[] = [
  {
    title: 'Get started',
    pages: [
      {
        href: '/docs',
        label: 'About sentinel-agent',
        blurb: 'What it does, what it refuses to do, and why that split is the product.',
      },
      {
        href: '/docs/tour',
        label: 'Guided tour',
        blurb: 'One incident, start to finish, with the numbers the agent actually computes.',
      },
      {
        href: '/docs/quickstart',
        label: 'Run it locally',
        blurb: 'Five things must be configured. Here they are, and the command that checks them.',
      },
    ],
  },
  {
    title: 'The safety model',
    pages: [
      {
        href: '/docs/approval-gate',
        label: 'The approval gate',
        blurb: 'How gating is derived, the failure mode it hides, and the three layers against it.',
      },
      {
        href: '/docs/tools',
        label: 'MCP tool surface',
        blurb: 'Thirteen tools, each with a risk class that decides whether it can run unattended.',
      },
      {
        href: '/docs/gate-prover',
        label: 'Gate Prover',
        blurb: 'Four routes at a destructive tool, and an honest verdict for each.',
      },
    ],
  },
  {
    title: 'How it works',
    pages: [
      {
        href: '/docs/sandbox',
        label: 'Sandbox execution',
        blurb: 'Why the magnitude is computed in Python instead of asserted in a tool response.',
      },
      {
        href: '/docs/subagents',
        label: 'Subagents',
        blurb: 'Three parallel investigation lines — and what the harness does not guarantee.',
      },
      {
        href: '/docs/architecture',
        label: 'Architecture',
        blurb: 'What runs where, and where every credential lives.',
      },
      {
        href: '/docs/limits',
        label: 'Honest limitations',
        blurb: 'The things this build does not do, stated plainly rather than implied away.',
      },
    ],
  },
];

export const DOCS_FLAT: DocPage[] = DOCS_NAV.flatMap((s) => s.pages);

export const adjacentPages = (href: string) => {
  const i = DOCS_FLAT.findIndex((p) => p.href === href);
  return {
    prev: i > 0 ? DOCS_FLAT[i - 1] : undefined,
    next: i >= 0 && i < DOCS_FLAT.length - 1 ? DOCS_FLAT[i + 1] : undefined,
  };
};
