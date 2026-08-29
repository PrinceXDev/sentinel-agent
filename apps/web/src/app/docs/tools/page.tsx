import type { Metadata } from 'next';
import Link from 'next/link';

import { CopyCommand } from '@/components/site/CopyCommand';
import {
  C,
  Callout,
  Code,
  H2,
  Lead,
  LI,
  P,
  PageHeader,
  PageNav,
  Table,
  UL,
} from '@/components/site/docs/DocKit';
import {
  MCP_TOOLS,
  TOOL_REGISTRY_EXAMPLE,
  TOOL_RISK_COUNTS,
  TOOL_RISK_META,
} from '@/constants/tools';

export const metadata: Metadata = {
  title: 'MCP tool surface — sentinel-agent docs',
  description:
    'Ten tools over streamable HTTP. Seven run unattended, three are gated, and the risk class that decides which is a required field.',
};

const ToolsPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="The safety model"
        title="MCP tool surface"
        lead="Ten tools over streamable HTTP. The split between them is not a naming convention — it is the field that decides whether a call can happen while you are getting coffee."
      />

      <Lead>
        Read-only tools run autonomously. Anything that writes or destroys is gated. Investigation
        should never need a click; remediation always should.
      </Lead>

      {/* Risk distribution */}
      <div className="my-9">
        <div className="flex h-3 overflow-hidden rounded-full border border-line">
          {TOOL_RISK_COUNTS.map(([risk, n]) => (
            <div
              key={risk}
              style={{
                width: `${(n / MCP_TOOLS.length) * 100}%`,
                background: TOOL_RISK_META[risk].color,
                opacity: TOOL_RISK_META[risk].gated ? 1 : 0.55,
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-7 gap-y-2 font-mono text-[11.5px]">
          {TOOL_RISK_COUNTS.map(([risk, n]) => (
            <span key={risk} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: TOOL_RISK_META[risk].color }}
              />
              <span className="text-ink">{n}</span>
              <span className="text-dim">
                {TOOL_RISK_META[risk].tag} ·{' '}
                {TOOL_RISK_META[risk].gated ? 'gated' : 'runs unattended'}
              </span>
            </span>
          ))}
        </div>
      </div>

      <Table
        head={['Tool', 'Risk', 'Gated', 'What it does']}
        rows={MCP_TOOLS.map((t) => [
          <C key={t.name}>{t.name}</C>,
          <span
            key={`${t.name}-r`}
            className="font-mono text-[12.5px]"
            style={{ color: TOOL_RISK_META[t.risk].color }}
          >
            {TOOL_RISK_META[t.risk].tag}
          </span>,
          TOOL_RISK_META[t.risk].gated ? (
            <span key={`${t.name}-g`} className="font-mono text-gate">
              yes
            </span>
          ) : (
            <span key={`${t.name}-g`} className="text-dim">
              —
            </span>
          ),
          t.does,
        ])}
      />

      <H2>Why export_metrics_csv returns nothing useful</H2>

      <P>
        It returns raw samples and no analysis, and that is the single most deliberate decision in
        the tool surface. A tool that answered &ldquo;p95 is up 3.7x&rdquo; would let the agent
        report a number it never derived, and the sandbox would become decoration. Returning samples
        forces the change point, the settled means and the ratio to be computed — which is the part
        an operator can actually check.
      </P>

      <Callout tone="note">
        The same principle runs through the fixtures: nothing in the estate states that{' '}
        <C>dpl-4c21</C> is the cause. The metrics change shape after 15:02, one diff explains why,
        and the connection has to be earned. See{' '}
        <Link href="/docs/tour" className="text-steel hover:underline">
          the guided tour
        </Link>
        .
      </Callout>

      <H2>How a tool is registered</H2>

      <Code lang="typescript">{TOOL_REGISTRY_EXAMPLE}</Code>

      <UL>
        <LI>
          <C>risk</C> is required. There is no overload without it, so &ldquo;forgot the
          annotations&rdquo; is not a state this codebase can reach.
        </LI>
        <LI>
          Annotations are derived from <C>risk</C>, never written by hand, so they cannot disagree
          with it.
        </LI>
        <LI>
          <C>registry.test.ts</C> re-checks both against the harness&rsquo;s own predicates, and
          against the agent spec&rsquo;s approval list.
        </LI>
      </UL>

      <H2>The eleventh tool</H2>

      <P>
        There is one more tool in the registry that is not in the table above:{' '}
        <C>rollback_deployment_unsafe</C>, a deliberately unannotated twin of the real thing. It
        exists so the{' '}
        <Link href="/docs/gate-prover" className="text-steel hover:underline">
          conformance suite
        </Link>{' '}
        can drive the exact bypass this project is built around and observe what the harness does,
        rather than asserting what it would do.
      </P>

      <Callout tone="warn" title="It is not on by default">
        The twin is only mounted with <C>OPS_LAB_MODE=1</C>, on a separate <C>/mcp-unsafe</C>{' '}
        endpoint, behind its own lab token — one auth policy per endpoint, checked once. A review
        finding on exactly that fall-through is in the repo&rsquo;s PR #4 write-up.
      </Callout>

      <CopyCommand
        command="npm run dev:mcp:lab"
        comment="mounts the unannotated twin — for the conformance suite only"
      />

      <H2>Verify the surface yourself</H2>

      <CopyCommand
        command={`curl -s -X POST http://localhost:8940/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}
        comment="every tool should carry annotations — count them"
      />
      <CopyCommand
        command="npm test --workspace @sentinel-agent/mcp-server"
        comment="72 tests, including the registry assertions"
      />

      <PageNav href="/docs/tools" />
    </>
  );
};

export default ToolsPage;
