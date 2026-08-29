import { DoctorMock, GateMock, SandboxMock, TimelineMock } from '@/components/site/mock/Panels';

/** The four alternating feature sections on the `/product` page. */
export const PRODUCT_FEATURES = [
  {
    eyebrow: '01 — Investigate',
    title: 'A whole triage, while you are still reading the page',
    body: 'The agent pulls the incident, the service health, and every deployment in a generous window, then fans three investigation lines out to subagents in parallel — symptom, change, mechanism. Isolated contexts; only conclusions come back.',
    link: { href: '/docs/tour', label: 'Walk the run' },
    panel: <TimelineMock />,
  },
  {
    eyebrow: '02 — Prove',
    title: 'The number is computed, not estimated',
    body: 'export_metrics_csv deliberately returns raw samples and no analysis. So the agent writes pandas, runs it in a sandbox that holds no credentials, splits the series at the deploy, skips the ramp, and compares settled to settled. Throughput stayed flat, which is what rules out a traffic surge.',
    link: { href: '/docs/sandbox', label: 'How the sandbox works' },
    panel: <SandboxMock />,
    flip: true,
  },
  {
    eyebrow: '03 — Stop',
    title: 'And then it stops, and asks',
    body: 'Before any gated call the agent must state the action, target, evidence, mechanism, expected effect, risk, reversibility and confidence. The approver reads that and nothing else. A thin case is treated as a failure, because a reasonable approver will decline it.',
    link: { href: '/docs/approval-gate', label: 'Inside the gate' },
    panel: <GateMock />,
  },
  {
    eyebrow: '04 — Verify',
    title: 'Five things must be right. One command tells you which is not.',
    body: 'A run needs a model, a sandbox provider, a connector, a skill and an operator token, spread across two processes and a harness UI. Any one missing surfaces as a 422 mid-run, worded from the harness’s point of view rather than yours. doctor checks all five up front — and re-verifies the safety model live, because an unannotated tool is the one failure that looks like success.',
    link: { href: '/docs/quickstart', label: 'Run it locally' },
    panel: <DoctorMock />,
    flip: true,
  },
];
