import type { Metadata } from 'next';
import Link from 'next/link';

import { SystemMap } from '@/components/site/charts/SystemMap';
import {
  C,
  Callout,
  Code,
  H2,
  LI,
  P,
  PageHeader,
  PageNav,
  Table,
  UL,
} from '@/components/site/docs/DocKit';

export const metadata: Metadata = {
  title: 'Architecture — sentinel-agent docs',
  description:
    'What runs where, where every credential lives, and the trust boundaries that two security findings redrew.',
};

const ArchitecturePage = () => {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="Architecture"
        lead="Four processes and one rule: every credential lives in the harness, and nothing else is trusted to hold one."
      />

      <SystemMap />

      <H2>The pieces</H2>

      <Table
        head={['Component', 'Runs on', 'Holds']}
        rows={[
          [
            <span key="a">
              <strong className="text-ink">sentinel-agent UI</strong>
              <div className="mt-1 text-[12.5px] text-dim">Next.js 16 · React 19</div>
            </span>,
            <C key="a2">127.0.0.1:3000</C>,
            'No agent logic and no credentials. A view over harness events: timeline, subagent threads, evidence, approval gate, audit trail.',
          ],
          [
            <span key="b">
              <strong className="text-ink">/tf route handler</strong>
              <div className="mt-1 text-[12.5px] text-dim">server-side proxy</div>
            </span>,
            'same process',
            <span key="b2">
              The harness token, server-side only. Streams SSE through; refuses cross-origin and
              untokened mutations.
            </span>,
          ],
          [
            <span key="c">
              <strong className="text-ink">TrueForge harness</strong>
            </span>,
            <C key="c2">localhost:8790</C>,
            <span key="c3" className="text-gate">
              Every credential. Agent loop, tool routing, approval gating, subagents, sandbox
              orchestration, session persistence, context management.
            </span>,
          ],
          [
            <span key="d">
              <strong className="text-ink">sentinel-ops MCP server</strong>
            </span>,
            <C key="d2">127.0.0.1:8940</C>,
            'Ten tools and a simulated estate. No credentials. Optional bearer token for its own protection, not for anyone else’s.',
          ],
        ]}
      />

      <H2>Credential boundaries</H2>

      <UL>
        <LI>
          The UI never sees the harness token — it is attached server-side by the route handler, so
          a browser devtools tab has nothing to steal.
        </LI>
        <LI>
          The sandbox never sees any key. Its tool calls are bridged out to the harness and executed
          there.
        </LI>
        <LI>
          The one external credential this repo ever handles is a model provider key, read once by{' '}
          <C>npm run provision</C> from <C>.env</C> and handed to the harness. Never read again.
        </LI>
        <LI>
          <C>OPS_LAB_TOKEN</C> and <C>OPS_MCP_TOKEN</C> are secrets you generate yourself with{' '}
          <C>openssl rand -hex 24</C>, not issued by anything.
        </LI>
      </UL>

      <H2>Trust model</H2>

      <Callout tone="gate" title="The gate protects a path, not a tool">
        Approval is enforced by the harness. The MCP server knows nothing about it. So anything that
        reaches the MCP server directly never encounters the gate — there is nothing there to
        encounter.
      </Callout>

      <P>Two consequences, both found by code review rather than by design, and both now closed:</P>

      <Table
        head={['Was', 'Meant', 'Now']}
        rows={[
          [
            <span key="a">
              MCP server bound <C>0.0.0.0</C>, <C>/mcp</C> unauthenticated
            </span>,
            <span key="a2" className="text-danger">
              <C>rollback_deployment</C> reachable from the LAN, never passing through the harness
            </span>,
            <span key="a3">
              Binds <C>127.0.0.1</C> (<C>OPS_MCP_HOST</C> to override); optional bearer auth with a
              constant-time compare; insecure posture logged at <C>error</C>; <C>/estate</C> CORS
              narrowed from <C>*</C> to known origins
            </span>,
          ],
          [
            'Proxy attached the server-held token for any caller',
            <span key="b2" className="text-danger">
              Anything able to reach <C>:3000</C> could approve a production rollback
            </span>,
            <span key="b3">
              <C>Sec-Fetch-Site</C> refuses cross-origin browser requests, and an operator token (
              <C>x-sentinel-operator</C>) is required for every state-changing method — closing
              local <C>curl</C> callers, which send no <C>Sec-Fetch-Site</C> at all. Fails closed
              when unconfigured
            </span>,
          ],
        ]}
      />

      <P>
        The second one took two rounds. The first attempt added the origin check and documented
        caller authentication as out of scope — and the reviewer did not mark it resolved,
        correctly: an origin check is not authentication, and the guard explicitly allowed
        non-browser callers, so a local <C>curl</C> could still submit an approval. The operator
        token is the actual fix.
      </P>

      <H2>Event flow</H2>

      <Code lang="one gated call, end to end">{`agent decides           → model.message { toolCalls: [{ id: call_71c, ... }] }
harness sees @destructive → tool.approval_required { tool_calls: [{ id, source_event_id }] }
turn ends                 → state.required_actions populated
UI joins on source_event_id → renders "rollback_deployment(dpl-4c21)" + the evidence brief
you decide                → POST /turns  { type: 'user.tool_approval', approval: { status } }
harness dispatches or not → tool.response, or the agent continues without it
estate records            → /estate/audit  (independent of the event stream)`}</Code>

      <P>
        The join on <C>source_event_id</C> is the non-obvious part — the approval event carries no
        tool name and no arguments, so a client without an event index has nothing to show but an
        id.{' '}
        <Link href="/docs/approval-gate" className="text-steel hover:underline">
          The gate page has the detail
        </Link>
        .
      </P>

      <H2>Deliberate omissions</H2>

      <UL>
        <LI>
          <strong className="text-ink">No database.</strong> Session state lives in the harness; the
          estate is in-process with its own audit log. Nothing here is worth persisting past a
          restart.
        </LI>
        <LI>
          <strong className="text-ink">No auth system.</strong> One operator token, checked in
          constant time, failing closed. A login screen would be a bigger surface for no gain on a
          loopback-only tool.
        </LI>
        <LI>
          <strong className="text-ink">No client-side agent logic.</strong> Every decision is the
          harness&rsquo;s. If the UI could decide anything, the UI would be part of the safety
          model.
        </LI>
      </UL>

      <PageNav href="/docs/architecture" />
    </>
  );
};

export default ArchitecturePage;
