/**
 * Dry-run tools — say what a destructive call would do, without doing it.
 *
 * Annotated `readOnlyHint: true`, so the agent can call these freely. That is the
 * point: the expensive, gated call should be the *second* thing that happens, and
 * an approver should never be the first entity in the loop to find out what a
 * rollback actually moves.
 *
 * The transition described here is computed by the same `#resolveRollback` the
 * real mutation uses, so a preview cannot claim one thing while the call performs
 * another. A dry run that could diverge from the real call is worse than no dry
 * run — it manufactures confidence rather than informing it.
 *
 * `reversible` is a field on the result and not a constant, because it genuinely
 * differs: a rollback can be undone by forward-deploying, and a restart cannot be
 * undone at all. Flattening that distinction is how a restart gets waved through
 * as "low risk, it comes back up".
 */

import { z } from 'zod';

import { estate } from '../domain/store.js';
import { defineTool, failure, json } from './define.js';

export const previewRemediation = defineTool({
  name: 'preview_remediation',
  title: 'Preview a remediation',
  description:
    'Compute exactly what a destructive tool would change, without changing anything. Returns ' +
    'the field-level state transition, blast radius, whether the action is reversible, and how ' +
    'to reverse it. Call this before requesting approval and include the result in your case — ' +
    'the approver is authorising this transition, and should not have to imagine it. Read-only.',
  risk: 'read',
  inputSchema: {
    action: z
      .enum(['rollback_deployment', 'restart_service'])
      .describe('Which destructive tool to preview.'),
    deployment_id: z
      .string()
      .optional()
      .describe('Required for rollback_deployment. The live deployment you would roll back.'),
    service: z
      .string()
      .optional()
      .describe('Required for restart_service. The service you would restart.'),
  },
  handler: ({ action, deployment_id, service }) => {
    if (action === 'rollback_deployment') {
      if (!deployment_id) {
        return failure('deployment_id is required when previewing rollback_deployment.');
      }
      return json(estate.previewRollback(deployment_id));
    }

    if (!service) {
      return failure('service is required when previewing restart_service.');
    }
    return json(estate.previewRestart(service));
  },
});

export const previewTools = [previewRemediation] as const;
