/**
 * Tests for the deliberately-unsafe twin.
 *
 * These are unusual: they assert that a tool is **wrong**, and fail if someone
 * makes it right.
 *
 * `rollback_deployment_unsafe` exists to demonstrate the silent approval bypass
 * described in `lib/riskClass.ts` — a destructive tool that publishes no MCP
 * annotations matches none of TrueForge's selector predicates, so
 * `require_approval_for_tools: ["@write", "@destructive"]` never matches it and
 * it runs with no human in the loop.
 *
 * The demonstration only holds while the twin stays unannotated. Adding
 * annotations to it would look like a fix, pass review, and quietly turn
 * `prove:gate` into a suite that proves nothing. So the absence is pinned here.
 *
 * The other half of the job is making sure the twin cannot leak into the real
 * server: `registry.test.ts` guarantees everything in `allTools` is annotated,
 * which is only meaningful if the twin is genuinely outside that array.
 */

import { describe, expect, it } from 'vitest';

import { requiresApprovalUnderDefaultPolicy } from '../lib/riskClass.js';
import { PRODUCTION_MUTATING_TOOLS, rollbackDeployment } from './destructive.js';
import { allTools } from './index.js';
import {
  buildUnsafeServer,
  UNSAFE_SERVER_NAME,
  UNSAFE_TWIN_ANNOTATIONS,
  UNSAFE_TWIN_TOOL,
} from './unsafeTwin.js';

describe('unannotated twin', () => {
  it('publishes no annotations — this is the bug being demonstrated', () => {
    // Not `toBeFalsy()`: an empty object is falsy in neither JS nor intent, and
    // `{}` would behave differently from `undefined` for some MCP clients. The
    // cookbook example omits the key entirely, so that is what is reproduced.
    expect(UNSAFE_TWIN_ANNOTATIONS).toBeUndefined();
  });

  it('is exempt from the default approval policy', () => {
    // The whole finding, in one assertion. A destructive operation that the
    // harness will happily run without asking anyone.
    expect(requiresApprovalUnderDefaultPolicy(UNSAFE_TWIN_ANNOTATIONS)).toBe(false);
  });

  it('is exempt where its annotated equivalent is not', () => {
    // The controlled comparison. Same operation, same estate mutation; the only
    // difference is the annotations, so the difference in gating is attributable
    // to them and nothing else.
    expect(requiresApprovalUnderDefaultPolicy(rollbackDeployment.annotations)).toBe(true);
    expect(requiresApprovalUnderDefaultPolicy(UNSAFE_TWIN_ANNOTATIONS)).toBe(false);
  });

  it('is not registered on the real server', () => {
    // If this ever fails, `registry.test.ts` is no longer covering the real tool
    // surface and the twin is reachable through the `sentinel-ops` connector.
    expect(allTools.map((t) => t.name)).not.toContain(UNSAFE_TWIN_TOOL);
  });

  it('is not named in the production-mutating list the agent spec pins', () => {
    // `PRODUCTION_MUTATING_TOOLS` drives the literal-name half of the belt-and-
    // braces policy. The twin must stay out of it: naming it there would gate it,
    // which would be a fix, which would destroy the demonstration.
    expect([...PRODUCTION_MUTATING_TOOLS]).not.toContain(UNSAFE_TWIN_TOOL);
  });

  it('builds a server under its own name, so a probe can attribute the result', () => {
    // A distinct server name is what lets `prove:gate` tell which connector
    // produced an event when both are registered on the same agent.
    expect(UNSAFE_SERVER_NAME).not.toBe('sentinel-ops');
    expect(() => buildUnsafeServer()).not.toThrow();
  });
});
