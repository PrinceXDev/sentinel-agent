export type AnnotationGateLane = {
  y: number;
  accent: string;
  title: string;
  steps: { top: string; bottom: string }[];
  outcome: { label: string; sub: string; color: string };
};

/** The two lanes drawn by the AnnotationGate diagram: annotated vs. unannotated tool. */
export const ANNOTATION_GATE_LANES: AnnotationGateLane[] = [
  {
    y: 62,
    accent: 'var(--color-gate)',
    title: 'Annotated',
    steps: [
      { top: 'rollback_deployment', bottom: 'MCP tool' },
      { top: 'destructiveHint: true', bottom: 'annotations' },
      { top: '@destructive', bottom: 'derived tag' },
      { top: 'in policy list', bottom: 'require_approval_for_tools' },
    ],
    outcome: { label: 'PAUSES', sub: 'human decides', color: 'var(--color-gate)' },
  },
  {
    y: 168,
    accent: 'var(--color-danger)',
    title: 'Unannotated',
    steps: [
      { top: 'rollback_deployment', bottom: 'identical tool' },
      { top: '— none published —', bottom: 'annotations' },
      { top: 'matches nothing', bottom: 'not even @read-only' },
      { top: 'not in policy list', bottom: 'nothing to match' },
    ],
    outcome: { label: 'EXECUTES', sub: 'no prompt at all', color: 'var(--color-danger)' },
  },
];
