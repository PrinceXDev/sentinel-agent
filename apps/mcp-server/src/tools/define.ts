/**
 * Tool definition helper.
 *
 * Every tool goes through `defineTool`, which takes `risk` as a **required**
 * field and derives the MCP annotations from it. There is no code path that
 * registers a tool without annotations, so the silent-approval-bypass described
 * in `lib/riskClass.ts` cannot be reintroduced by forgetting a line.
 *
 * `defineTool` returns a homogeneous `RegisterableTool` so the registry can be a
 * plain array while each tool keeps its own precisely-typed input schema.
 */

import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';
import { EstateError } from '../domain/store.js';
import { logger } from '../lib/logger.js';
import { ANNOTATIONS_FOR_RISK, type RiskClass } from '../lib/riskClass.js';

/**
 * What an MCP tool handler returns.
 *
 * This is the protocol's own `CallToolResult` rather than a parallel type of our
 * own. Defining a lookalike would drift from the spec and force casts at the
 * registration boundary; conforming to it means the compiler checks our payloads
 * against what an MCP client will actually accept.
 */
export type ToolResult = CallToolResult;

/** Serialise a value as the tool's text payload. */
export function json(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/**
 * Report a caller error to the agent in a form it can act on.
 *
 * `isError: true` matters: it tells the model the call failed rather than
 * returning data, so it retries or reports instead of treating the message as a
 * result.
 */
export function failure(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

export interface ToolSpec<S extends ZodRawShape> {
  readonly name: string;
  readonly title: string;
  /**
   * Shown to the model. Say what the tool observes or changes, and — for anything
   * not read-only — say plainly that it requires approval, so the agent plans
   * around the pause instead of being surprised by it.
   */
  readonly description: string;
  readonly risk: RiskClass;
  readonly inputSchema: S;
  /**
   * Typed as the SDK's own `ToolCallback<S>` so `args` is inferred straight from
   * `inputSchema` and stays assignable at the registration boundary. Handlers may
   * declare fewer parameters than the callback provides — most ignore `extra`.
   */
  readonly handler: ToolCallback<S>;
}

export interface RegisterableTool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly risk: RiskClass;
  readonly annotations: ToolAnnotations;
  register(server: McpServer): void;
}

export function defineTool<S extends ZodRawShape>(spec: ToolSpec<S>): RegisterableTool {
  const annotations = ANNOTATIONS_FOR_RISK[spec.risk];

  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    risk: spec.risk,
    annotations,
    register(server: McpServer): void {
      // Every tool gets the same instrumentation: timing, structured logging, and
      // one error policy. `ToolCallback<S>` is a conditional type over the schema
      // shape, so its parameters cannot be spread generically without help —
      // hence the two casts below. They are confined to this function, and the
      // externally-visible contract stays `ToolSpec<S>.handler: ToolCallback<S>`,
      // which the compiler does check at every call site.
      type Variadic = (...args: readonly unknown[]) => ToolResult | Promise<ToolResult>;
      const handler = spec.handler as unknown as Variadic;

      const instrumented = async (...args: readonly unknown[]): Promise<ToolResult> => {
        const started = Date.now();
        try {
          const result = await handler(...args);
          logger.info('tool.ok', {
            tool: spec.name,
            risk: spec.risk,
            ms: Date.now() - started,
          });
          return result;
        } catch (error) {
          // EstateError is a caller mistake the agent can recover from — hand it
          // back as content so the model can correct itself. Anything else is a
          // genuine fault: log it, and return a message that neither leaks
          // internals nor implies the estate changed.
          if (error instanceof EstateError) {
            logger.warn('tool.rejected', {
              tool: spec.name,
              reason: error.message,
            });
            return failure(error.message);
          }
          logger.error('tool.failed', {
            tool: spec.name,
            error: error instanceof Error ? error.message : String(error),
          });
          return failure(`${spec.name} failed unexpectedly. The estate was not modified.`);
        }
      };

      server.registerTool(
        spec.name,
        {
          title: spec.title,
          description: spec.description,
          inputSchema: spec.inputSchema,
          // The whole point of this module: annotations are never optional.
          annotations: { ...annotations, title: spec.title },
        },
        instrumented as unknown as ToolCallback<S>,
      );
    },
  };
}
