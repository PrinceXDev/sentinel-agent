export type ToolRisk = 'read' | 'write' | 'destructive';

/** The MCP tools sentinel-ops publishes, and their risk class. */
export const MCP_TOOLS: { name: string; risk: ToolRisk; does: string }[] = [
  { name: 'get_incident', risk: 'read', does: 'The incident record, its severity and its notes.' },
  { name: 'list_incidents', risk: 'read', does: 'Everything currently open on the estate.' },
  {
    name: 'get_service_health',
    risk: 'read',
    does: 'Live deployment id, replica counts, and the named checks.',
  },
  {
    name: 'list_recent_deployments',
    risk: 'read',
    does: 'Deployment history for a service, newest first.',
  },
  { name: 'get_deployment', risk: 'read', does: 'One deployment: version, author, changed files.' },
  {
    name: 'get_deployment_diff',
    risk: 'read',
    does: 'The unified diff. Where mechanism comes from.',
  },
  {
    name: 'export_metrics_csv',
    risk: 'read',
    does: 'Raw golden-signal samples. Deliberately no analysis.',
  },
  {
    name: 'preview_remediation',
    risk: 'read',
    does: 'What a destructive call would change, computed without doing it. Free to call.',
  },
  {
    name: 'post_incident_note',
    risk: 'write',
    does: 'Append a finding to the incident. Mutates shared state, so it asks.',
  },
  {
    name: 'record_finding',
    risk: 'write',
    does: 'The conclusion as structure: claims paired with sources, confidence, what was ruled out.',
  },
  {
    name: 'audit_finding',
    risk: 'write',
    does: 'An independent reviewer scores the evidence, not the conclusion.',
  },
  {
    name: 'rollback_deployment',
    risk: 'destructive',
    does: 'Redeploy the previous version. The action the whole product is arranged around.',
  },
  {
    name: 'restart_service',
    risk: 'destructive',
    does: 'Roll the pods. Cheap-looking, still production.',
  },
];

/** Tag, colour, and gating per risk class. */
export const TOOL_RISK_META: Record<ToolRisk, { tag: string; color: string; gated: boolean }> = {
  read: { tag: '@read-only', color: 'var(--color-steel)', gated: false },
  write: { tag: '@write', color: 'var(--color-gate)', gated: true },
  destructive: { tag: '@destructive', color: 'var(--color-danger)', gated: true },
};

/** Tool count per risk class, derived from `MCP_TOOLS`. */
export const TOOL_RISK_COUNTS: [ToolRisk, number][] = [
  ['read', MCP_TOOLS.filter((t) => t.risk === 'read').length],
  ['write', MCP_TOOLS.filter((t) => t.risk === 'write').length],
  ['destructive', MCP_TOOLS.filter((t) => t.risk === 'destructive').length],
];

/** Excerpt shown on the tools doc page illustrating `defineTool`. */
export const TOOL_REGISTRY_EXAMPLE = `export const rollbackDeployment = defineTool({
  name: 'rollback_deployment',
  risk: 'destructive',              // required — no overload without it
  description: 'Redeploy the previously live version of a service.',
  inputSchema: { deployment_id: z.string() },
  handler: async ({ deployment_id }) => { ... },
});

// annotations are derived, never hand-written:
//   read        → { readOnlyHint: true }
//   write       → { readOnlyHint: false }
//   destructive → { readOnlyHint: false, destructiveHint: true }`;
