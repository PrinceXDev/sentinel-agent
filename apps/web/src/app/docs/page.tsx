import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyCommand } from '@/components/site/CopyCommand';
import { SystemMap } from '@/components/site/charts/SystemMap';
import {
  C,
  Callout,
  H2,
  Lead,
  LI,
  P,
  PageHeader,
  PageNav,
  Stat,
  StatRow,
  Table,
  UL,
} from '@/components/site/docs/DocKit';
import { DOCS_NAV } from '@/lib/site/docsNav';

export const metadata: Metadata = {
  title: 'About sentinel-agent — docs',
  description:
    'What sentinel-agent does, what it deliberately refuses to do, and how the harness underneath enforces the difference.',
};

const AboutPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="Get started"
        title="About sentinel-agent"
        lead="An agent that takes a production incident from alert to prepared fix without asking you anything — and then stops dead before the one action that matters, and asks."
      />

      <Lead>
        When checkout latency triples, an engineer opens five tabs. Dashboards, to see the shape of
        it. The deploy log, to see what changed. GitHub, to read the diff. A terminal, to work out
        whether the change is big enough to explain it. And then a decision — roll back or keep
        digging — taken under time pressure on partial evidence.
      </Lead>

      <P>
        The investigation is mechanical. The decision is not. Almost every attempt to automate this
        goes wrong in one of two directions: the tool only <em>reports</em>, and leaves you exactly
        where you started, or it acts on its own, and now a language model&rsquo;s inference is
        wired straight into your production control plane.
      </P>

      <P>
        sentinel-agent does the mechanical part completely, and stops at the decision. That split is
        the product:{' '}
        <strong className="text-ink">investigation is automated, execution is authorised.</strong>
      </P>

      <StatRow>
        <Stat value="7" label="read-only tools that run with no prompt at all" tone="steel" />
        <Stat value="3" label="production-mutating tools, every one gated" tone="gate" />
        <Stat value="3.70×" label="the regression, computed in a sandbox from raw samples" />
        <Stat value="149" label="tests, including the ones that guard the gate" tone="ok" />
      </StatRow>

      <H2>What it actually does</H2>

      <P>
        Given one incident id, the agent reaches real systems over MCP, delegates three parallel
        lines of investigation to subagents, writes and runs diagnostic Python in an isolated
        sandbox to <em>compute</em> the magnitudes rather than estimate them, correlates the
        evidence into a root cause with a stated mechanism and a confidence number — and then
        pauses, holding the remediation until a human approves it.
      </P>

      <UL>
        <LI>
          <strong className="text-ink">It reads.</strong> Incident, service health, deployment
          history, diffs, raw golden-signal samples. All seven of those tools are read-only, so none
          of them ever interrupts you.
        </LI>
        <LI>
          <strong className="text-ink">It computes.</strong> <C>export_metrics_csv</C> returns
          samples and no analysis, on purpose. The change point, the settled means and the ratio all
          have to be derived — which is what makes the sandbox load-bearing rather than decorative.
        </LI>
        <LI>
          <strong className="text-ink">It argues.</strong> Before a gated call it must state action,
          target, evidence, mechanism, expected effect, risk, reversibility and confidence. A thin
          case is a failure, because a reasonable approver will decline it.
        </LI>
        <LI>
          <strong className="text-ink">It stops.</strong> Not by choice — by construction. The pause
          is enforced by the harness, in a place the agent cannot reach.
        </LI>
      </UL>

      <H2>How it works</H2>

      <P>
        Four processes, one credential boundary. The UI is a view over harness events and holds no
        agent logic; the harness holds every key; the MCP server is reachable only from loopback;
        the sandbox gets its tool calls bridged back out so no credential ever enters it.
      </P>

      <SystemMap />

      <Callout tone="gate" title="The one rule">
        Amber appears in exactly one place in this product — the approval gate. Nothing else uses
        it. That makes the moment the agent stops and asks visually unique rather than one alert
        among many, which is the entire point.
      </Callout>

      <H2>Why a harness is load-bearing</H2>

      <P>
        Remove TrueForge and this project does not degrade — it stops existing. Six things it
        carries that would otherwise have to be built from scratch, and gotten right under time
        pressure:
      </P>

      <Table
        head={['Capability', 'What it carries']}
        rows={[
          [
            <C key="a">MCP tool routing</C>,
            'Reaching the ops estate at all — discovery, schemas, dispatch.',
          ],
          [
            <C key="b">Approval gating</C>,
            'The entire safety model, enforced in the harness where the agent cannot bypass it.',
          ],
          [
            <C key="c">Sandbox orchestration</C>,
            'Isolated Python on demand, with tool calls bridged back so no credential enters it.',
          ],
          [
            <C key="d">Subagent delegation</C>,
            'Three investigation lines in parallel, isolated contexts, conclusions only.',
          ],
          [<C key="e">Session persistence</C>, 'Surviving a page reload mid-investigation.'],
          [
            <C key="f">Context management</C>,
            'Compaction and large-response offloading, so 61 samples plus four diffs still fit.',
          ],
        ]}
      />

      <P>
        The agent loop itself — plan, call tools, observe, decide, pause, resume — is the
        harness&rsquo;s. sentinel-agent contributes the domain, the safety classification, the
        methodology, and the view.
      </P>

      <H2>Security posture</H2>

      <UL>
        <LI>
          No credential reaches this repo, the sandbox, or the UI. All three live in the harness.
        </LI>
        <LI>
          The MCP server binds <C>127.0.0.1</C> by default and supports bearer auth, because the
          gate protects a <em>path</em>, not a tool — anything reaching the MCP server directly
          never encounters it.
        </LI>
        <LI>
          The UI proxy refuses cross-origin mutations and requires an operator token for every
          state-changing method. It fails closed when unconfigured.
        </LI>
        <LI>
          The estate is simulated, so no real system is reachable from this repo. The protocol
          traffic against it is not simulated.
        </LI>
      </UL>

      <H2>Try it in two commands</H2>

      <CopyCommand
        command="npm install && npm run dev:mcp"
        comment="ops MCP server on 127.0.0.1:8940"
      />
      <CopyCommand
        command="npm run doctor"
        comment="checks all five prerequisites before you waste a run on a 422"
      />

      <H2>Where to go next</H2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {DOCS_NAV.flatMap((s) => s.pages)
          .filter((p) => p.href !== '/docs')
          .map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="rounded-xl border border-line bg-surface p-5 transition hover:border-line-strong"
            >
              <div className="text-[15px] text-ink">{p.label}</div>
              <div className="mt-1.5 text-[13px] text-dim leading-relaxed">{p.blurb}</div>
            </Link>
          ))}
      </div>

      <PageNav href="/docs" />
    </>
  );
};

export default AboutPage;
