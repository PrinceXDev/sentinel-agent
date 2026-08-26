/**
 * Destructive tools — change production state.
 *
 * Annotated `readOnlyHint: false, destructiveHint: true`, which resolves to
 * TrueForge's `@destructive` tag. These are the calls that must not happen
 * without a human saying so, and they are named literally in the agent spec's
 * `require_approval_for_tools` as well as being covered by the tag — see
 * `lib/riskClass.ts` for why both.
 *
 * The descriptions tell the agent the pause is coming. An agent that knows it
 * will be interrupted writes a better justification before the interruption,
 * which is exactly what the human needs in order to decide.
 */

import { z } from 'zod';

import { estate } from '../domain/store.js';
import { defineTool, json } from './define.js';

/**
 * Tool names that mutate production. Exported so the registry test can assert
 * each one is annotated destructive, and so the agent spec can name them
 * literally rather than relying on a hand-maintained duplicate list.
 */
export const PRODUCTION_MUTATING_TOOLS = ['rollback_deployment', 'restart_service'] as const;

export const rollbackDeployment = defineTool({
  name: 'rollback_deployment',
  title: 'Roll back deployment',
  description:
    'Roll a service back to the deployment immediately preceding the given one, making that ' +
    'predecessor live again. This changes production state and cannot be undone without a ' +
    'forward deploy. A human must approve before it runs: state the deployment id, the evidence ' +
    'that implicates it, and your confidence, so the approver can judge it. ' +
    'Only the currently-live deployment can be rolled back.',
  risk: 'destructive',
  inputSchema: {
    deployment_id: z
      .string()
      .min(1)
      .describe('Id of the live deployment to roll back, e.g. "dpl-4c21".'),
    reason: z
      .string()
      .min(1)
      .max(2000)
      .describe(
        'Why this rollback is justified. Shown to the human approver — cite the evidence, not a summary.',
      ),
  },
  handler: ({ deployment_id, reason }) => {
    const result = estate.rollbackDeployment(deployment_id, 'sentinel-agent');
    return json({
      ...result,
      reason,
      note: 'Production state changed. Re-read metrics to confirm the symptom is recovering.',
    });
  },
});

export const restartService = defineTool({
  name: 'restart_service',
  title: 'Restart service',
  description:
    'Rolling-restart every replica of a service. Drops in-flight requests and clears connection ' +
    'pools. Changes production state and requires human approval. Prefer rolling back a suspect ' +
    'deployment over restarting, unless the evidence points at process state rather than code.',
  risk: 'destructive',
  inputSchema: {
    service: z.string().min(1).describe('Service to restart, e.g. "checkout-api".'),
    reason: z
      .string()
      .min(1)
      .max(2000)
      .describe('Why a restart is the right action here. Shown to the human approver.'),
  },
  handler: ({ service, reason }) => {
    const result = estate.restartService(service, 'sentinel-agent');
    return json({ ...result, reason });
  },
});

export const destructiveTools = [rollbackDeployment, restartService] as const;
