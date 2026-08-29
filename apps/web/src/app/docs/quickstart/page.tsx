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
  Step,
  Steps,
  Table,
  UL,
} from '@/components/site/docs/DocKit';
import { DoctorMock } from '@/components/site/mock/Panels';

export const metadata: Metadata = {
  title: 'Run it locally — sentinel-agent docs',
  description:
    'Five things must be configured across two processes and a harness UI. Here they are, in order, with the command that checks all five.',
};

const QuickstartPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="Get started"
        title="Run it locally"
        lead="A run needs five things configured across two processes and the harness UI. Any one missing surfaces as a 422 or a 403 mid-run, worded from the harness's point of view rather than yours."
      />

      <Lead>
        So the first useful command is not <C>dev</C>, it is <C>doctor</C> — which checks all five
        up front and tells you which one is missing and how to fix it.
      </Lead>

      <H2>Prerequisites</H2>

      <UL>
        <LI>
          <strong className="text-ink">Node.js 22.14+</strong> — the harness&rsquo;s floor. Under
          WSL, source <C>scripts/wsl-node.sh</C> first: it activates the right version and refuses
          to continue on a Windows interop Node, which is otherwise picked up silently.
        </LI>
        <LI>
          <strong className="text-ink">A model provider key</strong> — OpenAI, Anthropic, Gemini,
          OpenRouter, or any OpenAI-compatible endpoint.
        </LI>
        <LI>
          <strong className="text-ink">No Daytona key, on Linux or macOS.</strong> TrueForge&rsquo;s
          local sandbox provider activates once <C>bwrap</C>, <C>socat</C> and <C>rg</C> are on{' '}
          <C>PATH</C>. See{' '}
          <Link href="/docs/sandbox" className="text-steel hover:underline">
            Sandbox execution
          </Link>
          .
        </LI>
      </UL>

      <Callout tone="note" title="On Windows">
        TrueForge cannot run on Windows directly. <C>scripts/wsl-up.sh</C> brings the whole stack up
        under WSL for exactly that reason, and Daytona is the only sandbox option on that path.
      </Callout>

      <H2>The five steps</H2>

      <Steps>
        <Step n={1} title="Start the ops MCP server">
          <CopyCommand command="npm install" />
          <CopyCommand command="npm run dev:mcp" comment="listens on http://localhost:8940/mcp" />
          <P>
            A read-only view of the estate is served alongside it at <C>/estate/state</C>,{' '}
            <C>/estate/audit</C> and <C>/estate/tools</C>.
          </P>
        </Step>

        <Step n={2} title="Start the harness">
          <CopyCommand
            command="npx @truefoundry/trueforge@latest"
            comment="opens at http://localhost:8790"
          />
        </Step>

        <Step n={3} title="Configure it — or let provision do it">
          <P>By hand, in the TrueForge UI:</P>
          <UL>
            <LI>
              <strong className="text-ink">Settings → Models</strong> — add your provider and key.
            </LI>
            <LI>
              <strong className="text-ink">Settings → Sandbox providers</strong> — only if{' '}
              <C>doctor</C> reports the local fallback is <em>not</em> active. Otherwise skip
              entirely.
            </LI>
            <LI>
              <strong className="text-ink">Settings → Connectors → Add MCP Server</strong> — name it{' '}
              <C>sentinel-ops</C>, URL <C>http://localhost:8940/mcp</C>, no auth. The name must
              match the agent spec.
            </LI>
            <LI>
              <strong className="text-ink">Settings → Skills</strong> — register this repository,{' '}
              <C>ref</C> your branch, <C>path</C> <C>skills/incident-response</C>.
            </LI>
          </UL>
          <P>Or all three at once, idempotently:</P>
          <CopyCommand
            command="npm run provision"
            comment="reads .env; never registers a provider without a key; never touches an existing resource"
          />
        </Step>

        <Step n={4} title="Create the agent">
          <P>
            Take <C>agent/sentinel-agent.agent.json</C>, replace <C>REPLACE_WITH_YOUR_MODEL</C> with
            your configured model, and create the agent.
          </P>
          <Code lang="agent spec">{`"model": "anthropic/claude-sonnet-4-6",
"require_approval_for_tools": [
  "@write",
  "@destructive",
  "rollback_deployment",   // literal names too — belt and braces
  "restart_service"
]`}</Code>
          <Callout tone="warn" title="This step cannot be done in the UI">
            <C>require_approval_for_tools</C> is API-only. The agent must be created over the API,
            or with this spec inline on the session. Create it in the UI and you get an agent with
            no approval policy — which is the failure mode this whole project is about.
          </Callout>
        </Step>

        <Step n={5} title="Preflight">
          <CopyCommand command="npm run doctor" />
          <div className="mt-5">
            <DoctorMock />
          </div>
          <P>
            It exits non-zero when anything is blocking, so it composes into a script. And it
            re-verifies the safety model live: it calls <C>tools/list</C> on the running ops server
            and fails if any tool is unannotated, because an unannotated tool is exempt from
            approval — the one failure mode that looks like success.
          </P>
        </Step>
      </Steps>

      <H2>Then start the console</H2>

      <CopyCommand
        command="npm run dev:web"
        comment="127.0.0.1:3000 — the operator console, and these docs"
      />

      <H2>Every script, and what it does</H2>

      <Table
        head={['Command', 'Does']}
        rows={[
          [
            <C key="a">npm run doctor</C>,
            'Preflight: config, connectivity, live annotation check.',
          ],
          [
            <C key="b">npm run provision</C>,
            'Register model provider + connector + skill over the API.',
          ],
          [
            <C key="c">npm run prove:gate</C>,
            <span key="c2">
              Approval-gate conformance suite —{' '}
              <Link href="/docs/gate-prover" className="text-steel hover:underline">
                Gate Prover
              </Link>
            </span>,
          ],
          [<C key="d">npm run dev:mcp</C>, 'Ops MCP server, watch mode.'],
          [<C key="e">npm run dev:web</C>, 'Next.js UI on 127.0.0.1:3000.'],
          [<C key="f">npm test</C>, 'Full suite — 149 tests (72 MCP + 54 UI + 23 script/oracle).'],
          [<C key="g">npm run typecheck</C>, 'tsc --noEmit, strict, across both workspaces.'],
          [<C key="h">npm run check</C>, 'Biome lint + format, writing fixes.'],
          [<C key="i">npm run ci</C>, 'biome ci + typecheck + tests — what CI runs.'],
        ]}
      />

      <H2>Environment</H2>

      <P>
        See <C>.env.example</C>. A provider key is the one real external credential this project
        ever handles, and only <C>provision</C> reads it — once, to hand it to the harness, never
        again. Generate your own tokens for the rest:
      </P>

      <CopyCommand
        command="openssl rand -hex 24"
        comment="for SENTINEL_UI_TOKEN, OPS_MCP_TOKEN, OPS_LAB_TOKEN"
      />

      <Callout tone="warn">
        With <C>SENTINEL_UI_TOKEN</C> unset, the proxy returns 403 for every mutation rather than
        allowing them through. That is deliberate: an unconfigured safety control should refuse, not
        default open.
      </Callout>

      <H2>Confirm the safety model before you trust it</H2>

      <CopyCommand
        command="npm test"
        comment="the ones that matter are in apps/mcp-server/src/tools/registry.test.ts"
      />
      <CopyCommand
        command={`curl -s -X POST http://localhost:8940/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}
        comment="annotations, on the wire"
      />

      <PageNav href="/docs/quickstart" />
    </>
  );
};

export default QuickstartPage;
