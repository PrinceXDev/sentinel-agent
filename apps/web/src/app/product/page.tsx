import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyCommand } from '@/components/site/CopyCommand';
import { AnnotationGate } from '@/components/site/charts/AnnotationGate';
import { GateProbes } from '@/components/site/charts/GateProbes';
import { LatencyChart } from '@/components/site/charts/LatencyChart';
import { SignalDelta } from '@/components/site/charts/SignalDelta';
import { Reveal } from '@/components/site/Reveal';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteNav } from '@/components/site/SiteNav';
import { SmoothScroll } from '@/components/site/SmoothScroll';
import { HERO_POINTS, PLATFORM_PIECES } from '@/constants/product';
import { PRODUCT_FEATURES } from '@/constants/productFeatures';

export const metadata: Metadata = {
  title: 'sentinel-agent — autonomous incident response, human-controlled execution',
  description:
    'The agent investigates a production incident end to end, proves what happened from raw telemetry, prepares the fix — and refuses to touch production without you.',
};

const ProductOverview = () => {
  return (
    <SmoothScroll>
      <SiteNav />

      <main className="bg-ground">
        {/* ------------------------------------------------------------ hero */}
        <section className="gridfield relative overflow-hidden border-line border-b">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--color-steel)_11%,transparent),transparent)]" />
          <div className="relative mx-auto max-w-[1180px] px-6 pt-40 pb-24 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 font-mono text-[11px] text-muted">
              <span className="breathe h-1.5 w-1.5 rounded-full bg-gate" />
              built on the TrueForge agent harness
            </span>

            <h1 className="mx-auto mt-8 max-w-[19ch] font-medium text-[clamp(2.6rem,6.4vw,4.6rem)] text-ink leading-[1.03] tracking-[-0.03em]">
              Autonomous incident response,
              <br className="hidden sm:block" />{' '}
              <span className="text-gate">human-controlled execution.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-[62ch] text-[17px] text-muted leading-relaxed">
              Give the agent a production incident. It investigates it. It proves what happened from
              raw telemetry. It prepares the fix. And then it refuses to touch production without
              you.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docs/tour"
                className="rounded-md bg-gate px-5 py-3 font-medium text-[#231803] text-[14.5px] transition hover:brightness-110"
              >
                Take the guided tour
              </Link>
              <Link
                href="/docs"
                className="group flex items-center gap-2 rounded-md border border-line bg-surface px-5 py-3 text-[14.5px] text-ink transition hover:border-line-strong"
              >
                Read the docs
                <span className="text-dim transition group-hover:translate-x-0.5 group-hover:text-steel">
                  →
                </span>
              </Link>
            </div>

            <Reveal
              stagger
              className="mx-auto mt-20 grid max-w-[980px] gap-8 text-left sm:grid-cols-3"
            >
              {HERO_POINTS.map((p) => (
                <div key={p.title}>
                  <div className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-gate" />
                    <h3 className="font-medium text-[17px] text-ink">{p.title}</h3>
                  </div>
                  <p className="mt-2.5 text-[14px] text-muted leading-relaxed">{p.body}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* -------------------------------------------------------- features */}
        <section className="mx-auto max-w-[1180px] px-6 py-24">
          <Reveal>
            <div className="eyebrow">01 — the run</div>
            <h2 className="mt-3 max-w-[18ch] font-medium text-[clamp(1.9rem,4vw,3rem)] text-ink leading-[1.08] tracking-[-0.02em]">
              What the agent does on its own.
            </h2>
          </Reveal>

          <div className="mt-20 space-y-28">
            {PRODUCT_FEATURES.map((f) => (
              <Reveal key={f.title}>
                <div
                  className={`grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] ${
                    f.flip ? 'lg:[&>*:first-child]:order-2' : ''
                  }`}
                >
                  <div>
                    <div className="eyebrow">{f.eyebrow}</div>
                    <h3 className="mt-3 max-w-[20ch] font-medium text-[clamp(1.5rem,2.6vw,2.1rem)] text-ink leading-[1.14] tracking-[-0.02em]">
                      {f.title}
                    </h3>
                    <p className="mt-4 max-w-[52ch] text-[15px] text-muted leading-relaxed">
                      {f.body}
                    </p>
                    <Link
                      href={f.link.href}
                      className="mt-6 inline-block border-line-strong border-b pb-1 text-[14px] text-ink transition hover:border-steel hover:text-steel"
                    >
                      {f.link.label} →
                    </Link>
                  </div>
                  <div className="min-w-0" data-speed="1.04">
                    {f.panel}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- the evidence */}
        <section className="border-line border-y bg-[#0c1014]">
          <div className="mx-auto max-w-[1180px] px-6 py-24">
            <Reveal>
              <div className="eyebrow">02 — the evidence</div>
              <h2 className="mt-3 max-w-[24ch] font-medium text-[clamp(1.9rem,4vw,3rem)] text-ink leading-[1.08] tracking-[-0.02em]">
                Nothing in the estate says which deployment did it.
              </h2>
              <p className="mt-5 max-w-[68ch] text-[15.5px] text-muted leading-relaxed">
                The fixtures are generated by a pure function with a fixed seed, so every clone sees
                the same incident. But no constant in them names a cause. The metrics simply change
                shape after 15:02, one of four diffs explains why, and the agent has to connect
                those two facts itself.
              </p>
            </Reveal>

            <Reveal>
              <LatencyChart />
            </Reveal>

            <Reveal>
              <SignalDelta />
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------ the gate bug */}
        <section className="mx-auto max-w-[1180px] px-6 py-24">
          <Reveal>
            <div className="eyebrow">03 — the bug it is built around</div>
            <h2 className="mt-3 max-w-[22ch] font-medium text-[clamp(1.9rem,4vw,3rem)] text-ink leading-[1.08] tracking-[-0.02em]">
              A tool with no annotations is exempt from approval.
            </h2>
            <p className="mt-5 max-w-[70ch] text-[15.5px] text-muted leading-relaxed">
              The harness derives gating entirely from MCP tool annotations, and the default policy
              is <code className="font-mono text-ink">["@write", "@destructive"]</code>. A tool that
              publishes no annotations matches no tag — not even{' '}
              <code className="font-mono">@read-only</code> — so it matches nothing in the policy
              and executes with no prompt at all. Nothing in review looks wrong. The tool is
              correct, the agent config is correct, and the gate simply never triggers.
            </p>
          </Reveal>

          <Reveal>
            <AnnotationGate />
          </Reveal>

          <Reveal stagger className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              [
                'Structural',
                'Every tool is built through defineTool, which requires a risk class and derives annotations from it. No code path registers a tool without them.',
              ],
              [
                'Tested',
                "registry.test.ts asserts against the harness's own predicates rather than our labels. Add a destructive tool without classifying it and CI fails.",
              ],
              [
                'Belt and braces',
                'The agent spec names the destructive tools literally as well as by tag, so the gate holds even if an SDK version drops annotations in transit.',
              ],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-line bg-surface p-6">
                <h3 className="font-medium text-[15px] text-gate">{title}</h3>
                <p className="mt-2.5 text-[13.5px] text-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </Reveal>

          <Reveal>
            <div className="mt-8 text-[14px] text-dim">
              Verified against{' '}
              <code className="font-mono text-muted">@modelcontextprotocol/sdk</code> 1.30.0 — 10/10
              tools carry annotations into <code className="font-mono text-muted">tools/list</code>,
              zero unannotated.{' '}
              <Link href="/docs/approval-gate" className="text-steel hover:underline">
                Read the whole mechanism →
              </Link>
            </div>
          </Reveal>
        </section>

        {/* --------------------------------------------------------- platform */}
        <section className="border-line border-y bg-[#0c1014]">
          <div className="mx-auto max-w-[1180px] px-6 py-24">
            <Reveal>
              <div className="eyebrow">04 — the platform underneath</div>
              <h2 className="mt-3 max-w-[20ch] font-medium text-[clamp(1.9rem,4vw,3rem)] text-ink leading-[1.08] tracking-[-0.02em]">
                Five pieces, and where each one lives.
              </h2>
            </Reveal>

            <Reveal stagger className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORM_PIECES.map((p) => (
                <div
                  key={p.n}
                  className="rounded-xl border border-line bg-surface p-7 transition hover:border-line-strong"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-dim">{p.n}</span>
                    <h3 className="font-medium text-[17px] text-ink">{p.title}</h3>
                  </div>
                  <p className="mt-3 text-[14px] text-muted leading-relaxed">{p.body}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------ gate prover */}
        <section className="mx-auto max-w-[1180px] px-6 py-24">
          <Reveal>
            <div className="eyebrow">05 — proof, not assertion</div>
            <h2 className="mt-3 max-w-[24ch] font-medium text-[clamp(1.9rem,4vw,3rem)] text-ink leading-[1.08] tracking-[-0.02em]">
              We attack our own gate and publish what happens.
            </h2>
            <p className="mt-5 max-w-[70ch] text-[15.5px] text-muted leading-relaxed">
              <code className="font-mono text-ink">npm run prove:gate</code> drives four different
              routes at <code className="font-mono text-ink">rollback_deployment</code> against a
              live harness and cross-checks each verdict against two independent oracles — the event
              stream, and the estate&rsquo;s own audit log. Two of the four verdicts below are
              deliberately not a pass.
            </p>
          </Reveal>

          <Reveal>
            <GateProbes />
          </Reveal>

          <Reveal>
            <CopyCommand
              command="npm run prove:gate"
              comment="writes reports/gate-conformance.json, committed as evidence"
            />
            <Link
              href="/docs/gate-prover"
              className="inline-block border-line-strong border-b pb-1 text-[14px] text-ink transition hover:border-steel hover:text-steel"
            >
              What the suite found in itself →
            </Link>
          </Reveal>
        </section>

        {/* -------------------------------------------------------------- cta */}
        <section className="border-line border-t bg-[radial-gradient(70%_100%_at_50%_100%,color-mix(in_oklab,var(--color-gate)_9%,transparent),transparent)]">
          <div className="mx-auto max-w-[820px] px-6 py-28 text-center">
            <h2 className="font-medium text-[clamp(2rem,4.5vw,3.2rem)] text-ink leading-[1.06] tracking-[-0.025em]">
              Investigation is automated.
              <br />
              Execution is authorised.
            </h2>
            <p className="mx-auto mt-6 max-w-[54ch] text-[16px] text-muted leading-relaxed">
              That split is the whole product. Everything else — the tools, the sandbox, the
              subagents, the tests — exists to make one half trustworthy enough that the other half
              is worth keeping.
            </p>

            <div className="mx-auto mt-9 max-w-[560px] text-left">
              <CopyCommand command="git clone https://github.com/PrinceXDev/sentinel-agent && npm install" />
              <CopyCommand
                command="npm run doctor"
                comment="tells you which of the five things is missing"
              />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docs/quickstart"
                className="rounded-md bg-gate px-5 py-3 font-medium text-[#231803] text-[14.5px] transition hover:brightness-110"
              >
                Full setup, step by step
              </Link>
              <Link
                href="/docs/limits"
                className="rounded-md border border-line bg-surface px-5 py-3 text-[14.5px] text-ink transition hover:border-line-strong"
              >
                What it cannot do
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </SmoothScroll>
  );
};

export default ProductOverview;
