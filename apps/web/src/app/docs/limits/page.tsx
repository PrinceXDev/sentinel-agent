import type { Metadata } from 'next';
import Link from 'next/link';

import {
  C,
  Callout,
  H2,
  Lead,
  LI,
  P,
  PageHeader,
  PageNav,
  Table,
  UL,
} from '@/components/site/docs/DocKit';
import { PROJECT_LIMITS } from '@/constants/limits';

export const metadata: Metadata = {
  title: 'Honest limitations — sentinel-agent docs',
  description:
    'What this build does not do, stated plainly: unenforced subagent roles, a simulated estate, missing harness events, and a conformance report that is not yet complete.',
};

const LimitsPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="Honest limitations"
        lead="Everything on this page is a thing the project does not do. It is a page rather than a footnote because a safety claim with an undisclosed gap in it is worse than no claim."
      />

      <Lead>
        The rule applied throughout: where something is unverified, it says so. Two of the four Gate
        Prover verdicts are deliberately not a pass for the same reason.
      </Lead>

      <div className="my-9 space-y-4">
        {PROJECT_LIMITS.map((l) => (
          <div key={l.title} className="rounded-xl border border-line bg-surface p-6">
            <h3 className="text-[16px] text-ink">{l.title}</h3>
            <p className="mt-2.5 max-w-[66ch] text-[14px] text-muted leading-relaxed">{l.body}</p>
            <Link
              href={l.href}
              className="mt-3 inline-block font-mono text-[12px] text-steel hover:underline"
            >
              context →
            </Link>
          </div>
        ))}
      </div>

      <H2>Things that used to be listed here and no longer are</H2>

      <Callout tone="win" title="Daytona was never a hard requirement">
        This project&rsquo;s own README once claimed a Daytona key was mandatory, and that
        &ldquo;Daytona is TrueForge&rsquo;s only sandbox provider&rdquo;. Both were wrong. The local
        provider needs <C>bwrap</C>, <C>socat</C> and <C>rg</C> and no external account at all. On
        this project&rsquo;s dev machine only <C>bwrap</C> was missing. Daytona remains the only
        option on Windows, where the harness cannot run directly.
      </Callout>

      <H2>Known open work</H2>

      <Table
        head={['Item', 'Blocked on']}
        rows={[
          [
            'Reproduce the P2 bypass in a fresh conformance report',
            <span key="a">
              Recreating the <C>sentinel-ops-unsafe</C> connector with the current lab token
            </span>,
          ],
          [
            'Exercise P4 for real',
            'Getting the model to provision a sandbox and call the tool through the bridge, rather than reporting route_not_exercised',
          ],
          ['Demo video', 'Not started'],
          [
            'Point the tool surface at a real observability API',
            'A credentials change, not an architecture change',
          ],
          ['Multi-incident triage — rank concurrent incidents by blast radius', 'Not started'],
          ['Post-incident report generation from the session evidence graph', 'Not started'],
        ]}
      />

      <H2>What is not on this page</H2>

      <UL>
        <LI>
          The safety model. Ten of ten tools carry annotations on the wire, three are gated three
          ways, and the tests assert it against the harness&rsquo;s own predicates.
        </LI>
        <LI>
          The credential boundary. No key reaches this repo, the sandbox, or the UI.{' '}
          <C>npm audit</C> reports zero vulnerabilities.
        </LI>
        <LI>
          The arithmetic. The 3.70x figure is computed from 61 raw samples in a sandbox, and you can
          reproduce it from a clean clone.
        </LI>
      </UL>

      <P>
        If you find something that belongs on this page and is not on it, that is a bug in the docs
        rather than a difference of opinion.{' '}
        <Link href="/docs" className="text-steel hover:underline">
          Back to the start →
        </Link>
      </P>

      <PageNav href="/docs/limits" />
    </>
  );
};

export default LimitsPage;
