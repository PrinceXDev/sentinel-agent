import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyCommand } from '@/components/site/CopyCommand';
import { AnnotationGate } from '@/components/site/charts/AnnotationGate';
import {
  C,
  Callout,
  Code,
  H2,
  H3,
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
import {
  APPROVAL_GATE_DEFINE_TOOL,
  APPROVAL_GATE_EVENT_EXAMPLE,
  APPROVAL_GATE_RESOLVE_EXAMPLE,
  APPROVAL_GATE_SELECTORS,
} from '@/constants/codeSnippets';

export const metadata: Metadata = {
  title: 'The approval gate — sentinel-agent docs',
  description:
    'How TrueForge derives approval from MCP annotations, the failure mode that makes an unannotated destructive tool exempt, and the three layers that close it.',
};

const ApprovalGatePage = () => {
  return (
    <>
      <PageHeader
        eyebrow="The safety model"
        title="The approval gate"
        lead="This is the part worth reading closely, because it is the part most likely to be built wrong — and when it is built wrong, everything still looks correct."
      />

      <Lead>
        sentinel-agent&rsquo;s whole claim is that irreversible actions pause for a human. That
        claim rests entirely on a mechanism it does not own: the harness derives approval from the
        annotations an MCP server publishes, and dispatches or pauses accordingly.
      </Lead>

      <H2>How the harness decides</H2>

      <P>
        Three predicates, evaluated against the annotations that come back from <C>tools/list</C>:
      </P>

      <Code lang="typescript">{APPROVAL_GATE_SELECTORS}</Code>

      <P>
        An agent&rsquo;s <C>require_approval_for_tools</C> defaults to{' '}
        <C>["@write", "@destructive"]</C>. Tools matching those tags pause. Everything else runs
        autonomously.
      </P>

      <H2>The failure mode this project is built around</H2>

      <Callout tone="warn" title="A tool that publishes no annotations matches no tag">
        Not <C>@read-only</C>. Not <C>@write</C>. Not <C>@destructive</C>. It matches{' '}
        <em>nothing</em> — and the default policy is a list of tags, so an unannotated tool is
        absent from it and executes immediately, with no prompt at all.
      </Callout>

      <AnnotationGate />

      <P>
        So a <C>rollback_deployment</C> that forgot its annotations fires straight at production,
        silently. And nothing in review looks wrong: the tool is correct, the agent config is
        correct, the policy is correct. The gate just never triggers. There is no error, no warning,
        and no log line that says a call skipped approval — the successful path and the unsafe path
        are byte-identical from the outside.
      </P>

      <P>
        The shipped <C>bring-your-own-mcp</C> cookbook example publishes zero annotations. Copying
        it as a template — which is exactly what you do when you are starting out — is how you
        inherit this.
      </P>

      <H2>Three layers, so it cannot happen here</H2>

      <Steps>
        <Step n={1} title="Structural — you cannot register an unclassified tool">
          <P>
            Every tool is created through <C>defineTool</C>, which takes{' '}
            <C>risk: 'read' | 'write' | 'destructive'</C> as a required field and derives the
            annotations from it. There is no code path that registers a tool without them, because
            there is no way to call the function without saying what kind of tool it is.
          </P>
          <Code lang="typescript">{APPROVAL_GATE_DEFINE_TOOL}</Code>
        </Step>

        <Step n={2} title="Tested — against the harness's predicates, not our labels">
          <P>
            <C>registry.test.ts</C> asserts that every tool is annotated, that its annotations match
            its declared risk, and that every production-mutating tool is named in the agent
            spec&rsquo;s approval list — using TrueForge&rsquo;s own selector functions rather than
            a local reimplementation of them. Add a destructive tool without classifying it and CI
            fails before review does.
          </P>
        </Step>

        <Step n={3} title="Belt and braces — literal names as well as tags">
          <P>
            The agent spec names <C>rollback_deployment</C> and <C>restart_service</C> literally in{' '}
            <C>require_approval_for_tools</C>, alongside the tags. A literal name matches
            unconditionally, so the gate holds even if an SDK version drops annotations somewhere in
            transit.
          </P>
        </Step>
      </Steps>

      <Callout tone="win">
        Verified on the wire against <C>@modelcontextprotocol/sdk</C> 1.30.0 — all ten tools carry
        annotations into <C>tools/list</C>, zero unannotated. <C>npm run doctor</C> re-checks this
        against the running server every time, because an unannotated tool is the one failure mode
        that looks like success.
      </Callout>

      <CopyCommand
        command={`curl -s -X POST http://localhost:8940/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}
        comment="see the annotations yourself"
      />

      <H2>How approval actually resolves</H2>

      <P>
        There is no approval endpoint in TrueForge, and no approval id. This surprises people, so
        here is the whole flow.
      </P>

      <H3>1. The harness emits an event that tells you almost nothing</H3>

      <Code lang="json">{APPROVAL_GATE_EVENT_EXAMPLE}</Code>

      <P>
        To render &ldquo;Approve rollback of <C>dpl-4c21</C>?&rdquo; a client must keep a{' '}
        <C>Map&lt;eventId, event&gt;</C> of everything it has seen, follow <C>source_event_id</C>{' '}
        back to the originating <C>model.message</C>, and find the matching tool call inside it.
        That index is mandatory, not an optimisation — without it there is nothing to put on the
        screen but an id.
      </P>

      <H3>2. Resolution is a new turn</H3>

      <Code lang="http">{APPROVAL_GATE_RESOLVE_EXAMPLE}</Code>

      <UL>
        <LI>One item per pending call.</LI>
        <LI>
          Approval items must never be mixed with user messages in the same turn — the harness
          returns 422.
        </LI>
        <LI>
          On a cold reload, <C>GET /turns/{'{turn_id}'}</C> → <C>state.required_actions</C> recovers
          anything still pending, so a refresh mid-investigation does not strand the run.
        </LI>
      </UL>

      <H2>The gate protects a path, not a tool</H2>

      <P>
        This is the consequence that a code review caught and that is worth internalising: approval
        is enforced by the <em>harness</em>. The MCP server knows nothing about it. So anything that
        reaches the MCP server directly never encounters the gate, because there is nothing there to
        encounter.
      </P>

      <Table
        head={['Route', 'Passes the gate?', 'Control']}
        rows={[
          ['agent → harness → MCP server', 'Yes — this is the gate', 'Annotations + policy'],
          [
            'anything on the LAN → MCP server',
            <span key="b" className="text-danger">
              No — bypasses it entirely
            </span>,
            <span key="b2">
              Binds <C>127.0.0.1</C>; optional <C>OPS_MCP_TOKEN</C> bearer auth
            </span>,
          ],
          [
            'a browser on another site → UI proxy',
            <span key="c" className="text-danger">
              No — would approve on your behalf
            </span>,
            <span key="c2">
              <C>Sec-Fetch-Site</C> check
            </span>,
          ],
          [
            'local curl → UI proxy',
            <span key="d" className="text-danger">
              No — sends no <C>Sec-Fetch-Site</C> at all
            </span>,
            <span key="d2">
              Operator token <C>x-sentinel-operator</C>, fails closed
            </span>,
          ],
        ]}
      />

      <P>
        Binding the MCP server to all interfaces therefore did not weaken the safety model — it
        offered a way around it entirely. That finding, and the five others from the same review,
        are written up in the repository&rsquo;s Qodo section.
      </P>

      <Callout tone="gate" title="What we do about the parts we cannot prove by argument">
        An argument that a gate holds is not evidence that it holds. So there is a suite that
        attacks it from four directions and publishes what happened, including the routes it failed
        to exercise —{' '}
        <Link href="/docs/gate-prover" className="text-steel hover:underline">
          Gate Prover
        </Link>
        .
      </Callout>

      <PageNav href="/docs/approval-gate" />
    </>
  );
};

export default ApprovalGatePage;
