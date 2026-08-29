import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyCommand } from '@/components/site/CopyCommand';
import { LatencyChart } from '@/components/site/charts/LatencyChart';
import { SignalDelta } from '@/components/site/charts/SignalDelta';
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
  Stat,
  StatRow,
  Step,
  Steps,
  Table,
  UL,
} from '@/components/site/docs/DocKit';
import { GateMock, TimelineMock } from '@/components/site/mock/Panels';
import { TOUR_INCIDENT_DIFF } from '@/constants/codeSnippets';

export const metadata: Metadata = {
  title: 'Guided tour — sentinel-agent docs',
  description:
    'One incident from alert to approval, with the raw telemetry, the arithmetic, the diff, and the moment the agent stops.',
};

const TourPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="Get started"
        title="Guided tour"
        lead="One incident, start to finish. Every number on this page is one the agent derives itself — nothing in the estate names a cause, and nothing in the tool responses hands over a ratio."
      />

      <Lead>
        It is 15:04 UTC. A synthetic probe has been failing its checkout budget for two minutes, and
        it is not recovering. That is all anyone knows.
      </Lead>

      <div className="my-8 overflow-hidden rounded-xl border border-danger/40 bg-[color-mix(in_oklab,var(--color-danger)_7%,transparent)]">
        <div className="border-danger/25 border-b px-5 py-3 font-mono text-[11px] text-danger uppercase tracking-[0.14em]">
          INC-2048 · SEV-2 · investigating
        </div>
        <div className="px-5 py-4">
          <h3 className="text-[16px] text-ink">Checkout p95 latency regression</h3>
          <p className="mt-2 max-w-[62ch] text-[14px] text-muted leading-relaxed">
            Synthetic checkout probe breached its 400ms p95 budget and has stayed above it. Card
            authorisation success is unaffected; customers see slow checkouts and some 5xx.
          </p>
          <div className="mt-3 font-mono text-[11.5px] text-dim">
            service checkout-api · detected 15:04:00Z by synthetic-probe/checkout-p95
          </div>
        </div>
      </div>

      <H2>Step 0 — start the stack</H2>

      <P>
        Two processes and a harness. If you would rather read than run, skip ahead: everything below
        this point is reproducible, but nothing below this point requires you to have run it.
      </P>

      <CopyCommand
        command="npm run dev:mcp"
        comment="terminal 1 — ops MCP server on 127.0.0.1:8940"
      />
      <CopyCommand
        command="npx @truefoundry/trueforge@latest"
        comment="terminal 2 — the harness, on :8790"
      />
      <CopyCommand
        command="npm run dev:web"
        comment="terminal 3 — this UI, plus the operator console on :3000"
      />

      <Callout tone="note">
        <C>npm run provision</C> registers the model provider, the <C>sentinel-ops</C> connector and
        the <C>incident-response</C> skill over the API, idempotently — it never touches a resource
        that already exists. <C>npm run doctor</C> then tells you which of the five prerequisites is
        still missing. Full detail in{' '}
        <Link href="/docs/quickstart" className="text-steel hover:underline">
          Run it locally
        </Link>
        .
      </Callout>

      <H2>What happens next, in order</H2>

      <Steps>
        <Step n={1} title="It orients">
          <P>
            Four read-only calls, no prompts: the incident, the service health, the deployment
            history, and the golden signals. Read-only tools are annotated <C>readOnlyHint: true</C>
            , so the harness never pauses on them. Investigation should never need a click.
          </P>
          <div className="mt-5">
            <TimelineMock />
          </div>
        </Step>

        <Step n={2} title="It splits into three">
          <P>
            Three subagents run concurrently with isolated contexts, and return conclusions rather
            than transcripts:
          </P>
          <UL>
            <LI>
              <C>performance-investigator</C> — characterise the symptom. When did it start, and how
              big is it?
            </LI>
            <LI>
              <C>deployment-investigator</C> — enumerate every change in a generous window, and rule
              candidates in or out on timing alone.
            </LI>
            <LI>
              <C>code-investigator</C> — read the diffs of the timing-plausible candidates and
              assess mechanism.
            </LI>
          </UL>
          <P>
            The root agent correlates. That judgement is never delegated — and{' '}
            <Link href="/docs/subagents" className="text-steel hover:underline">
              the fan-out is a convention, not a guarantee
            </Link>
            .
          </P>
        </Step>

        <Step n={3} title="It asks for the raw numbers">
          <P>
            <C>export_metrics_csv</C> returns 61 minute-resolution samples across the incident
            window and <em>no analysis whatsoever</em>. This is deliberate. A tool that returned
            &ldquo;p95 is up 3.7x&rdquo; would make the sandbox decorative; a tool that returns
            samples makes it load-bearing.
          </P>
          <LatencyChart />
          <P>
            The shape is legible to a human in about a second: flat, a step at 15:02, a short ramp,
            a new plateau. None of that is legible to a model reading 61 rows of CSV, which is
            exactly why it has to do arithmetic instead of pattern-matching.
          </P>
        </Step>

        <Step n={4} title="It does the arithmetic properly">
          <P>
            In a sandboxed Python 3.13 with pandas — provisioned on demand, holding no credentials.
            The method matters more than the result: split at the deploy,{' '}
            <em>throw away the ramp</em>, and compare settled to settled.
          </P>
          <Code lang="python · sandbox">{`import pandas as pd

df     = pd.read_csv("metrics.csv", parse_dates=["ts"])
deploy = pd.Timestamp("2026-08-25T15:02:00Z")

before = df[df.ts <  deploy]                              # 32 samples
after  = df[df.ts >= deploy + pd.Timedelta(minutes=4)]    # 25 samples, ramp skipped

ratio = after.p95_latency_ms.mean() / before.p95_latency_ms.mean()
print(before.p95_latency_ms.mean(), after.p95_latency_ms.mean(), ratio)
# 177.9  658.2  3.6997...`}</Code>
          <P>
            Including the ramp would have dragged the plateau mean down and understated the
            regression. Averaging the whole window would have understated it badly. The four-minute
            exclusion is the difference between a number and a defensible number.
          </P>
          <SignalDelta />
          <Callout tone="win" title="What the third row buys you">
            Throughput did not move. That single flat line rules out the most common alternative
            explanation — a traffic surge — without anyone having to argue about it. Latency and
            errors moving together while throughput holds is the signature of something inside the
            service, not something arriving at it.
          </Callout>
        </Step>

        <Step n={5} title="It lines up the suspects">
          <P>Four deployments are in the window. Only one is even timing-plausible.</P>
          <Table
            head={['Deployment', 'When', 'Change', 'Verdict on timing']}
            rows={[
              [
                <C key="a">dpl-4c21</C>,
                <span key="a2" className="font-mono text-ink">
                  15:02
                </span>,
                'Raise upstream client timeout and add retries for flaky tax provider',
                <span key="a3" className="text-danger">
                  2 min before detection — candidate
                </span>,
              ],
              [
                <C key="b">dpl-4c20</C>,
                <span key="b2" className="font-mono">
                  24 Aug
                </span>,
                'Emit cart-abandonment counter',
                <span key="b3" className="text-ok">
                  ruled out, 28h earlier
                </span>,
              ],
              [
                <C key="c">dpl-4c19</C>,
                <span key="c2" className="font-mono">
                  22 Aug
                </span>,
                'Bump payment SDK to 4.2.1',
                <span key="c3" className="text-ok">
                  ruled out
                </span>,
              ],
              [
                <C key="d">dpl-4c18</C>,
                <span key="d2" className="font-mono">
                  20 Aug
                </span>,
                'Cache tax lookup responses for 60s',
                <span key="d3" className="text-ok">
                  ruled out
                </span>,
              ],
            ]}
          />
          <P>
            Timing narrows it to one. Timing alone does not explain <em>why</em> — so the diff has
            to be read.
          </P>
        </Step>

        <Step n={6} title="It finds the mechanism">
          <Code lang="diff · dpl-4c21 · a19f3c2 · r.okafor">{TOUR_INCIDENT_DIFF}</Code>
          <P>
            This is a good change, made for a good reason, by someone paying attention. The tax
            provider really had been flaky. And three retries against a 30-second ceiling on a path
            with a 400ms end-to-end budget is where a 3.7x tail comes from.
          </P>
          <Callout tone="note" title="Why this fixture and not a sillier one">
            The interesting incidents are never a typo. They are a plausible change with a
            non-obvious consequence — the only kind worth asking an agent to diagnose, and the only
            kind where a stated <em>mechanism</em> is worth more than a correlation.
          </Callout>
        </Step>

        <Step n={7} title="And then it stops">
          <P>
            The agent has a fix, a mechanism, and a number. What it does not have is permission. The
            harness sees a call to a tool annotated <C>destructiveHint: true</C>, emits{' '}
            <C>tool.approval_required</C>, and ends the turn. Nothing else happens until a human
            acts.
          </P>
          <div className="mt-5">
            <GateMock />
          </div>
          <P>
            Every field in that brief is required by the skill before a gated call. The approver
            reads it and nothing else, so a thin case is treated as a failure of the run rather than
            a style problem.
          </P>
        </Step>

        <Step n={8} title="You decide — and the estate remembers">
          <P>
            Approval resolves as a <em>new turn</em>, not an endpoint call. Deny and the agent
            continues without the rollback. Approve and it executes, then re-checks the signals. The
            estate keeps its own audit log at <C>/estate/audit</C>, independent of the harness event
            stream, so the agent&rsquo;s account of what it did can be cross-checked against what
            actually changed.
          </P>
          <CopyCommand
            command="curl -s http://127.0.0.1:8940/estate/audit | jq '.[-3:]'"
            comment="the estate's own record, not the agent's summary of it"
          />
        </Step>
      </Steps>

      <H2>What you just watched</H2>

      <StatRow>
        <Stat value="0" label="clicks required to reach a root cause" tone="steel" />
        <Stat value="1" label="click required to change production" tone="gate" />
        <Stat value="61" label="raw samples the agent had to reduce itself" />
        <Stat value="0.91" label="stated confidence, with the evidence attached" tone="ok" />
      </StatRow>

      <P>
        Every mechanical step ran unattended. The one irreversible step did not, and could not — not
        because the model was well-behaved, but because the harness refuses to dispatch the call.
        That refusal is the subject of{' '}
        <Link href="/docs/approval-gate" className="text-steel hover:underline">
          the next page
        </Link>
        , including the way it silently fails to happen if a tool forgets four lines of metadata.
      </P>

      <Callout tone="honest">
        Model behaviour is not deterministic. The fixtures are byte-identical on every boot, but the
        investigation path varies between runs — a different order of tool calls, a different number
        of subagents, occasionally a detour. The evidence it must produce before the gate does not
        vary.
      </Callout>

      <PageNav href="/docs/tour" />
    </>
  );
};

export default TourPage;
