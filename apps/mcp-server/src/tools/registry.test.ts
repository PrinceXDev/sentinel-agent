/**
 * The safety-critical test in this repository.
 *
 * TrueForge derives approval gating entirely from MCP tool annotations. A tool
 * that publishes none matches no selector tag, so under the default policy
 * `["@write", "@destructive"]` it runs with **no approval prompt** — a
 * `rollback_deployment` that forgot its annotations would fire at production
 * silently, and nothing in review would look wrong.
 *
 * These tests close that hole. They assert against the annotations the wire will
 * actually carry, using TrueForge's own predicates rather than our `RiskClass`
 * label, so a mistake in the mapping is caught rather than confirmed.
 *
 * If you add a tool that changes production state and do not classify it
 * `destructive`, `production mutation is always gated` fails.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { requiresApprovalUnderDefaultPolicy, TRUEFORGE_TAG_FOR_RISK } from '../lib/riskClass.js';
import { allTools, PRODUCTION_MUTATING_TOOLS } from './index.js';

const AGENT_SPEC_PATH = fileURLToPath(
  new URL('../../../../agent/sentinel-agent.agent.json', import.meta.url),
);

interface AgentSpec {
  mcp_servers?: { name: string; require_approval_for_tools?: string[] }[];
  config?: { sandbox?: { enabled?: boolean } };
  skills?: { name: string }[];
}

const agentSpec: AgentSpec = JSON.parse(readFileSync(AGENT_SPEC_PATH, 'utf8')) as AgentSpec;
const opsServer = agentSpec.mcp_servers?.find((s) => s.name === 'sentinel-ops');
const approvalSelectors = opsServer?.require_approval_for_tools ?? [];

describe('tool registry', () => {
  it('registers at least one tool', () => {
    expect(allTools.length).toBeGreaterThan(0);
  });

  it('has no duplicate tool names', () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(allTools.map((t) => [t.name, t] as const))('%s publishes annotations', (_name, tool) => {
    // The silent-bypass case. An unannotated tool is exempt from every tag.
    expect(tool.annotations).toBeDefined();
    expect(Object.keys(tool.annotations).length).toBeGreaterThan(0);
  });

  it.each(allTools.map((t) => [t.name, t] as const))(
    '%s annotations match its declared risk class',
    (_name, tool) => {
      const shouldGate = tool.risk !== 'read';
      expect(requiresApprovalUnderDefaultPolicy(tool.annotations)).toBe(shouldGate);
    },
  );

  it('read-only tools set readOnlyHint true and are never gated', () => {
    for (const tool of allTools.filter((t) => t.risk === 'read')) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(requiresApprovalUnderDefaultPolicy(tool.annotations)).toBe(false);
    }
  });

  it('destructive tools set destructiveHint true', () => {
    const destructive = allTools.filter((t) => t.risk === 'destructive');
    expect(destructive.length).toBeGreaterThan(0);
    for (const tool of destructive) {
      expect(tool.annotations.destructiveHint).toBe(true);
      expect(tool.annotations.readOnlyHint).toBe(false);
    }
  });

  it('write tools resolve to @write, not @destructive', () => {
    // isWrite requires readOnlyHint === false AND destructiveHint !== true.
    for (const tool of allTools.filter((t) => t.risk === 'write')) {
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.annotations.destructiveHint).not.toBe(true);
    }
  });

  it('every gated tool tells the agent a human gate exists', () => {
    // An agent that knows a pause is coming writes a better justification before
    // it, so the description has to say so. Matching the stem accepts "requires
    // approval", "a human must approve", and "shown to the approver" alike —
    // what matters is that the gate is stated, not which word states it.
    for (const tool of allTools.filter((t) => t.risk !== 'read')) {
      expect(tool.description.toLowerCase()).toMatch(/approv/);
    }
  });
});

describe('agent spec agrees with the registry', () => {
  it('declares the sentinel-ops MCP server', () => {
    expect(opsServer).toBeDefined();
  });

  it('production mutation is always gated', () => {
    // Belt and braces. The tag covers these tools already; naming them literally
    // means they stay gated even if an SDK version drops annotations in transit.
    for (const name of PRODUCTION_MUTATING_TOOLS) {
      expect(approvalSelectors).toContain(name);
    }
  });

  it('every destructive tool in the registry appears in PRODUCTION_MUTATING_TOOLS', () => {
    const destructiveNames = allTools.filter((t) => t.risk === 'destructive').map((t) => t.name);
    expect([...destructiveNames].sort()).toEqual([...PRODUCTION_MUTATING_TOOLS].sort());
  });

  it('keeps the @write and @destructive tags in the approval policy', () => {
    expect(approvalSelectors).toContain(TRUEFORGE_TAG_FOR_RISK.write);
    expect(approvalSelectors).toContain(TRUEFORGE_TAG_FOR_RISK.destructive);
  });

  it('never puts @read-only in the approval policy', () => {
    // @read-only is illegal on require_approval_for_tools — the harness would
    // reject the spec. Asserting it here fails fast in CI instead of at runtime.
    expect(approvalSelectors).not.toContain('@read-only');
  });

  it('enables the sandbox, because skills require it', () => {
    expect(agentSpec.config?.sandbox?.enabled).toBe(true);
    expect(agentSpec.skills?.length ?? 0).toBeGreaterThan(0);
  });
});
