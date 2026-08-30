/** Site-wide values shared across the marketing chrome (nav, footer). */

export const SITE_REPO_URL = 'https://github.com/PrinceXDev/sentinel-agent';

export const NAV_LINKS = [
  { href: '/', label: 'Product' },
  { href: '/docs', label: 'Docs' },
  { href: '/docs/tour', label: 'Tour' },
  { href: '/docs/gate-prover', label: 'Proof' },
];

export const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/', label: 'Overview' },
      { href: '/console', label: 'Operator console' },
      { href: '/docs/tools', label: 'MCP tool surface' },
      { href: '/docs/gate-prover', label: 'Gate Prover' },
    ],
  },
  {
    title: 'Docs',
    links: [
      { href: '/docs', label: 'About sentinel-agent' },
      { href: '/docs/tour', label: 'Guided tour' },
      { href: '/docs/approval-gate', label: 'The approval gate' },
      { href: '/docs/quickstart', label: 'Run it locally' },
    ],
  },
  {
    title: 'Depth',
    links: [
      { href: '/docs/sandbox', label: 'Sandbox execution' },
      { href: '/docs/subagents', label: 'Subagents' },
      { href: '/docs/architecture', label: 'Architecture' },
      { href: '/docs/limits', label: 'Honest limitations' },
    ],
  },
];

export const FOOTER_BADGES = [
  'MIT licensed',
  '262 tests',
  '0 npm vulnerabilities',
  '13/13 MCP tools annotated',
];
