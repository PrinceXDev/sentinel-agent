/** Honest-limitations entries listed on `/docs/limits`. */
export const PROJECT_LIMITS = [
  {
    title: 'Subagent role names are prompt convention',
    body: 'The harness has no way to declare named subagents. AgentSpec has no subagent field, and create_sub_agent takes a name the model invents and a brief the model writes. The three roles are specified in the instructions and in the skill, and the model follows them — but the fan-out is not guaranteed and the names are not enforced.',
    href: '/docs/subagents',
  },
  {
    title: 'The estate is simulated',
    body: 'Real MCP protocol traffic, fixture data. No real system is reachable from this repo, which is also why /estate/audit exists — so the agent’s account of what it did can be cross-checked against what actually changed.',
    href: '/docs/architecture',
  },
  {
    title: 'The conformance report is a partial run',
    body: 'reports/gate-conformance.json currently contains one probe, P4, with "complete": false. The P1 and P3 "gate held" verdicts and the P2 bypass come from earlier runs written up in PR #4. Reproducing all four in one fresh report is open work.',
    href: '/docs/gate-prover',
  },
  {
    title: 'P4 has never actually been exercised',
    body: 'The sandbox-bridge route reports route_not_exercised because the model never provisioned a sandbox and called the tool through the bridge. That verdict means untested. It does not mean safe, and it is deliberately not rendered as a pass.',
    href: '/docs/gate-prover',
  },
  {
    title: 'No compaction or sandbox-command events exist',
    body: 'TrueForge does not emit them, so the console cannot surface either directly. You can see that a sandbox turn happened; you cannot see the code it ran or its stdout from the UI.',
    href: '/docs/sandbox',
  },
  {
    title: 'Skills load only from public repository URLs',
    body: 'github.com and gitlab.com only. There is no private-repo credential field, so a skill in a private repository cannot be registered.',
    href: '/docs/quickstart',
  },
  {
    title: 'Model behaviour is not deterministic',
    body: 'The fixtures are byte-identical on every boot; the investigation path is not. Runs vary in tool order, subagent count, and occasional detours. What does not vary is the evidence required before a gated call.',
    href: '/docs/tour',
  },
];
