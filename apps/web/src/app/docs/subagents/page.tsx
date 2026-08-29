import type { Metadata } from 'next';
import Link from 'next/link';

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
import { SUBAGENT_ROLES } from '@/constants/subagents';

export const metadata: Metadata = {
  title: 'Subagents — sentinel-agent docs',
  description:
    'Three investigation lines in parallel with isolated contexts — and a clear statement of what the harness enforces versus what is only prompt convention.',
};

const SubagentsPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="Subagents"
        lead="Three investigation lines run concurrently with isolated contexts. Only conclusions come back — and the correlation between them is never delegated."
      />

      <Lead>
        Splitting the work is not about speed. It is about keeping three different kinds of evidence
        from contaminating each other before they are compared: a subagent that has already read the
        diff will find the timing more convincing than it should.
      </Lead>

      <H2>The three roles</H2>

      <div className="my-8 space-y-4">
        {SUBAGENT_ROLES.map((r) => (
          <div key={r.name} className="rounded-xl border border-line bg-surface p-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <code className="font-mono text-[14px] text-steel">{r.name}</code>
              <span className="text-[13.5px] text-ink">{r.brief}</span>
            </div>
            <p className="mt-3 max-w-[64ch] text-[14px] text-muted leading-relaxed">{r.body}</p>
            <p className="mt-3 font-mono text-[12px] text-dim">returns → {r.returns}</p>
          </div>
        ))}
      </div>

      <P>
        The root agent correlates the three. It has to reconcile a symptom, a candidate and a
        mechanism into one claim with a confidence number attached, and that judgement is the part a
        human is actually approving. It is never handed to a subagent.
      </P>

      <H2>What the harness actually gives you</H2>

      <Code lang="typescript">{`// this is the whole API
create_sub_agent({ name, input, model })`}</Code>

      <Table
        head={['', 'Reality']}
        rows={[
          [
            'Declaring named subagents',
            <span key="a" className="text-danger">
              Not possible. <C>AgentSpec</C> has no subagent field.
            </span>,
          ],
          [
            'The name',
            <span key="b">Invented by the model at call time, not registered anywhere.</span>,
          ],
          [
            'The brief',
            <span key="c">
              Written by the model as <C>input</C>. Not a template you control.
            </span>,
          ],
          [
            'Tool access',
            <span key="d">Subagents always inherit the root&rsquo;s full tool set.</span>,
          ],
          ['Nesting', <span key="e">Forbidden. A subagent cannot spawn one.</span>],
        ]}
      />

      <Callout tone="honest" title="These roles are convention, not capability">
        The three names above are specified in the agent&rsquo;s instructions and in the{' '}
        <C>incident-response</C> skill, and the model follows that convention. The harness does not
        enforce the names and does not guarantee the fan-out — a run may use two subagents, or four,
        or do a line of investigation inline. This is a prompt-level pattern, and it is documented
        as one rather than implied to be more.
      </Callout>

      <H2>What that means in practice</H2>

      <UL>
        <LI>
          Because subagents inherit every tool, a subagent can in principle reach a{' '}
          <em>destructive</em> tool. It does not get to skip the gate for doing so — that route is
          probe P3 in{' '}
          <Link href="/docs/gate-prover" className="text-steel hover:underline">
            Gate Prover
          </Link>
          , and it held. Before that suite existed, nobody had written down whether it did.
        </LI>
        <LI>
          Isolated contexts are the reason 61 samples, four diffs and a deployment history fit at
          all. The root agent sees conclusions, not the transcripts that produced them.
        </LI>
        <LI>
          The console renders subagent threads as separate lanes, so you can see which line of
          investigation produced which claim rather than a single flat log.
        </LI>
      </UL>

      <PageNav href="/docs/subagents" />
    </>
  );
};

export default SubagentsPage;
