import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyCommand } from '@/components/site/CopyCommand';
import { LatencyChart } from '@/components/site/charts/LatencyChart';
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
  Table,
  UL,
} from '@/components/site/docs/DocKit';
import { SANDBOX_ANALYSIS_EXAMPLE } from '@/constants/codeSnippets';

export const metadata: Metadata = {
  title: 'Sandbox execution — sentinel-agent docs',
  description:
    'Why the regression is computed in Python instead of asserted in a tool response, and how the sandbox runs untrusted code without ever holding a credential.',
};

const SandboxPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="Sandbox execution"
        lead="The regression's magnitude is never handed to the agent. It has to be computed — which is the difference between an agent that reports a number and one that can be checked."
      />

      <Lead>
        <C>export_metrics_csv</C> returns 61 minute-resolution samples and no analysis. If it
        returned &ldquo;p95 is up 3.7x&rdquo;, the sandbox would be decorative and the agent would
        be quoting a constant. Returning samples makes the arithmetic load-bearing.
      </Lead>

      <H2>The analysis, in full</H2>

      <Code lang="python · running in the sandbox">{SANDBOX_ANALYSIS_EXAMPLE}</Code>

      <StatRow>
        <Stat
          value="3.70×"
          label="p95 latency, settled baseline vs settled plateau"
          tone="danger"
        />
        <Stat value="15.3×" label="error rate — moved with latency" tone="danger" />
        <Stat value="-0.1%" label="throughput — did not move at all" tone="ok" />
        <Stat value="57" label="samples used; 4 discarded as ramp" tone="steel" />
      </StatRow>

      <P>
        Three decisions in that script are doing real work, and each of them would be easy to get
        wrong:
      </P>

      <UL>
        <LI>
          <strong className="text-ink">Split at the change point, not the window midpoint.</strong>{' '}
          The deploy timestamp comes from <C>list_recent_deployments</C>, not from eyeballing the
          series.
        </LI>
        <LI>
          <strong className="text-ink">Throw away the ramp.</strong> The four minutes after the
          deploy are a transient — pools filling, retries stacking. Including them drags the plateau
          mean down and understates the regression.
        </LI>
        <LI>
          <strong className="text-ink">Check the signals that should not have moved.</strong> Flat
          throughput is what rules out a traffic surge. A conclusion that only looks at the signal
          that broke is a conclusion that cannot be falsified.
        </LI>
      </UL>

      <LatencyChart />

      <H2>Where the code runs, and what it can reach</H2>

      <P>
        Generated code is untrusted by definition — it was written seconds ago by a model, in
        response to data. So the sandbox is provisioned on demand and holds nothing worth stealing.
      </P>

      <Table
        head={['', 'Inside the sandbox']}
        rows={[
          ['Runtime', <span key="a">Python 3.13. No Node runtime.</span>],
          [
            'Preinstalled',
            <span key="b">
              <C>pandas</C>, <C>requests</C>, <C>pydantic</C>, <C>openpyxl</C>
            </span>,
          ],
          [
            'Time limit',
            <span key="c">
              60 seconds per <C>exec</C> call
            </span>,
          ],
          [
            'Credentials',
            <span key="d" className="text-ok">
              None. Tool calls are bridged back to the harness, where the real keys live.
            </span>,
          ],
          [
            'Provider',
            <span key="e">
              Daytona if configured, otherwise TrueForge&rsquo;s <C>LocalSandboxProvider</C>
            </span>,
          ],
        ]}
      />

      <Callout tone="win" title="Untrusted code cannot exfiltrate a key it never had">
        The bridge is the whole trick. Sandbox code calls a tool; the call leaves the sandbox and is
        executed by the harness with the harness&rsquo;s credentials; only the result comes back. No
        secret ever crosses the boundary, so there is nothing for a bad line of generated Python to
        find.
      </Callout>

      <H2>You almost certainly do not need Daytona</H2>

      <P>
        This project&rsquo;s own README used to claim a Daytona API key was a hard requirement. That
        was wrong. TrueForge ships a <C>LocalSandboxProvider</C> on Linux and macOS that needs three
        host binaries and no external account at all.
      </P>

      <CopyCommand
        command="sudo apt install bubblewrap socat ripgrep"
        comment="bwrap, socat, rg — the only prerequisites"
      />

      <Code lang="harness log, once they are present">{`info Local sandbox fallback is available {"platform":"linux","shell":"/usr/bin/bash","python":"/usr/bin/python3.10"}`}</Code>

      <P>
        <C>npm run doctor</C> then reports{' '}
        <C>sandbox provider — none configured — local fallback confirmed active in harness log</C>.
        A Daytona key is only required if that provider fails to start, and on Windows, where
        TrueForge cannot run directly — hence <C>scripts/wsl-up.sh</C>, which brings the whole stack
        up under WSL for exactly that reason.
      </P>

      <Callout tone="honest">
        TrueForge emits no sandbox-command events, so the UI cannot surface the code the agent ran
        or its stdout directly. You can see that a sandbox turn happened; you cannot yet see inside
        it from the console. Read it from the harness&rsquo;s own view in the meantime.{' '}
        <Link href="/docs/limits" className="text-steel hover:underline">
          Other limitations →
        </Link>
      </Callout>

      <PageNav href="/docs/sandbox" />
    </>
  );
};

export default SandboxPage;
