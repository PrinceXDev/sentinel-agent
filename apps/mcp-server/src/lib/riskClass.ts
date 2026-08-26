/**
 * Risk classification for MCP tools, and the annotations that make TrueForge
 * enforce it.
 *
 * ## Why this file exists
 *
 * TrueForge decides whether a tool needs human approval purely from the MCP
 * annotations the server publishes. From `trueforge-core/src/core/mcp/toolSelectors.ts`:
 *
 * ```ts
 * function isReadOnly(a?: ToolAnnotations)    { return a?.readOnlyHint === true; }
 * function isWrite(a?: ToolAnnotations)       { return a?.readOnlyHint === false && a.destructiveHint !== true; }
 * function isDestructive(a?: ToolAnnotations) { return a?.destructiveHint === true; }
 * ```
 *
 * A tool that publishes **no** annotations matches none of those predicates.
 * The default agent policy is `require_approval_for_tools: ["@write", "@destructive"]`,
 * so an unannotated tool matches nothing in that list and **executes with no
 * approval prompt at all**. A `rollback_deployment` tool that forgot its
 * annotations would fire straight at production, silently.
 *
 * That is a one-line omission with an unbounded blast radius, and it is invisible
 * in review — the tool looks correct, the agent config looks correct, and the gate
 * simply never triggers.
 *
 * So annotations are not left to the author's memory here. Every tool declares a
 * `RiskClass`, the class deterministically produces the annotations, and
 * `tools/registry.test.ts` asserts that no tool can be registered without one and
 * that every `destructive` tool is *also* named literally in the agent spec's
 * `require_approval_for_tools`. Belt and braces: the tag covers it, and the literal
 * name covers it again if an SDK version ever drops annotations in transit.
 *
 * @see docs/architecture.md § The approval gate
 */

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/**
 * What a tool is allowed to do to the world.
 *
 * - `read`        — observes only. Safe to run autonomously, unlimited times.
 * - `write`       — changes non-production state (an incident note, a timeline entry).
 * - `destructive` — changes production state in a way a human must authorise.
 */
export type RiskClass = 'read' | 'write' | 'destructive';

/**
 * The MCP annotations TrueForge reads for each risk class.
 *
 * `write` sets `destructiveHint: false` explicitly rather than omitting it —
 * `isWrite` tests `destructiveHint !== true`, so omitting would also pass, but
 * stating it makes the intent legible to a human reviewer and to any other MCP
 * client with stricter rules.
 *
 * `read` deliberately omits `destructiveHint`: `readOnlyHint: true` is the whole
 * signal, and adding more would imply a distinction that does not exist.
 */
export const ANNOTATIONS_FOR_RISK: Readonly<Record<RiskClass, Readonly<ToolAnnotations>>> =
  Object.freeze({
    read: Object.freeze({ readOnlyHint: true }),
    write: Object.freeze({ readOnlyHint: false, destructiveHint: false }),
    destructive: Object.freeze({ readOnlyHint: false, destructiveHint: true }),
  });

/** Which TrueForge selector tag a risk class resolves to, for docs and tests. */
export const TRUEFORGE_TAG_FOR_RISK: Readonly<Record<RiskClass, string>> = Object.freeze({
  read: '@read-only',
  write: '@write',
  destructive: '@destructive',
});

/**
 * True when these annotations would make TrueForge pause for human approval
 * under the default policy `["@write", "@destructive"]`.
 *
 * This mirrors TrueForge's own predicates rather than trusting our risk class,
 * so the test suite is checking the wire format an agent will actually see.
 */
export function requiresApprovalUnderDefaultPolicy(annotations?: ToolAnnotations): boolean {
  if (!annotations) return false; // the silent-bypass case this module exists to prevent
  const isDestructive = annotations.destructiveHint === true;
  const isWrite = annotations.readOnlyHint === false && annotations.destructiveHint !== true;
  return isDestructive || isWrite;
}
