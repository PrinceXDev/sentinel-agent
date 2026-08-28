/**
 * The unannotated twin — a deliberately unsafe tool, for proving the bypass.
 *
 * ## Read this before touching anything in here
 *
 * Every other tool in this repository is built through `defineTool`, which takes
 * `risk` as a required field and derives MCP annotations from it. That is the
 * structural guarantee described in `lib/riskClass.ts`: there is no code path
 * that registers a production-mutating tool without annotations.
 *
 * This file is the exception, and it exists to make that guarantee *falsifiable*.
 *
 * `rollback_deployment_unsafe` is the same operation as `rollback_deployment` —
 * same store method, same estate mutation, same blast radius. The only
 * difference is that it publishes **no annotations at all**, exactly as
 * TrueForge's own `bring-your-own-mcp` cookbook example does.
 *
 * From `trueforge-core/src/core/mcp/toolSelectors.ts`:
 *
 * ```ts
 * function isReadOnly(a?: ToolAnnotations)    { return a?.readOnlyHint === true; }
 * function isWrite(a?: ToolAnnotations)       { return a?.readOnlyHint === false && a.destructiveHint !== true; }
 * function isDestructive(a?: ToolAnnotations) { return a?.destructiveHint === true; }
 * ```
 *
 * With no annotations all three predicates are false. The agent policy
 * `require_approval_for_tools: ["@write", "@destructive"]` therefore matches
 * nothing, and the tool executes **with no approval prompt at all**. Production
 * state changes and the human is never asked.
 *
 * That is a claim, and claims about safety are worth little. `scripts/prove-gate.mjs`
 * runs it against a live harness and reports what actually happened, cross-checked
 * against the estate's own audit log.
 *
 * ## Why it is safe to have this in the repository
 *
 *  1. It is **not** in `allTools`, so `buildServer()` never registers it and the
 *     `sentinel-ops` connector cannot reach it. The registry tests are unaffected
 *     because, as far as the real server is concerned, this tool does not exist.
 *  2. It is served on a **separate endpoint** (`/mcp-unsafe`) that only exists
 *     when `OPS_LAB_MODE=1`.
 *  3. The estate it mutates is simulated and in-memory.
 *  4. `unsafeTwin.test.ts` asserts it stays unannotated. If someone "fixes" it by
 *     adding annotations the proof silently stops proving anything, so that is a
 *     test failure rather than a tidy-up.
 *
 * Never add this tool to `allTools`. Never give it annotations.
 *
 * @see scripts/prove-gate.mjs
 * @see docs/architecture.md § The approval gate
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { EstateError, estate } from '../domain/store.js';
import { logger } from '../lib/logger.js';
import { failure, json, type ToolResult } from './define.js';

export const UNSAFE_SERVER_NAME = 'sentinel-ops-unsafe';
export const UNSAFE_TWIN_TOOL = 'rollback_deployment_unsafe';

/**
 * The annotations this tool publishes: none.
 *
 * Exported as a named constant so the test asserts on the *absence* rather than
 * inferring it from a missing property. `undefined` is the whole point — not an
 * empty object, not `{ readOnlyHint: false }`, but nothing at all, which is what
 * an author who never considered annotations produces.
 */
export const UNSAFE_TWIN_ANNOTATIONS: ToolAnnotations | undefined = undefined;

const inputSchema = {
  deployment_id: z
    .string()
    .min(1)
    .describe('Id of the live deployment to roll back, e.g. "dpl-4c21".'),
};

/**
 * The same rollback as the real tool, minus the `reason` argument.
 *
 * Dropping `reason` is part of the point: a tool whose author never expected a
 * human to review it has no reason to ask its caller to justify itself.
 */
function handler({ deployment_id }: { deployment_id: string }): ToolResult {
  try {
    // The tool label is passed explicitly so the audit log — which prove:gate
    // treats as an independent oracle — attributes the mutation to the twin
    // rather than to the annotated tool that did not run.
    const result = estate.rollbackDeployment(
      deployment_id,
      'sentinel-agent:unsafe-twin',
      UNSAFE_TWIN_TOOL,
    );
    logger.error('unsafe_twin.executed', {
      tool: UNSAFE_TWIN_TOOL,
      deployment_id,
      detail:
        'Production state changed through the unannotated twin. If no approval was ' +
        'requested first, the gate was bypassed.',
    });
    return json({ ...result, via: UNSAFE_TWIN_TOOL });
  } catch (error) {
    if (error instanceof EstateError) return failure(error.message);
    throw error;
  }
}

/**
 * Build a server exposing only the unannotated twin.
 *
 * Separate from `buildServer()` on purpose. Mounting the twin alongside the real
 * tools would let one connector reach both, and a probe result would no longer
 * isolate which registration path produced the behaviour.
 */
export function buildUnsafeServer(): McpServer {
  const server = new McpServer(
    { name: UNSAFE_SERVER_NAME, version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    UNSAFE_TWIN_TOOL,
    {
      title: 'Roll back deployment (unannotated)',
      description:
        'Roll a service back to the deployment immediately preceding the given one. Changes ' +
        'production state and cannot be undone without a forward deploy.',
      inputSchema,
      // No `annotations` key. This omission is the entire experiment: it is what
      // the cookbook example does, and it is what disables the gate.
    },
    handler,
  );

  return server;
}
