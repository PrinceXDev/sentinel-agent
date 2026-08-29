'use client';

/**
 * Instructions found in estate content, reported rather than obeyed.
 *
 * Incident notes, deploy messages and code comments are all attacker-influenceable
 * in a real estate, and an agent wired to a rollback tool is worth steering. This
 * panel is what the agent saw, quoted, alongside what it was being asked to do.
 *
 * Two presentation rules, both load-bearing:
 *
 *  1. **The payload is quoted on a hatched ground.** Text engineered to look like
 *     a system directive must not be able to borrow the product's own chrome —
 *     the texture marks it as quarantined material on display, not as the
 *     interface speaking. A plain `<blockquote>` would let the attack render as
 *     legitimate UI, which is most of what the attack is trying to achieve.
 *  2. **It is `text-threat`, never `text-danger`.** Danger means something is
 *     broken. This means something tried to steer the agent, and conflating the
 *     two would put a prompt-injection attempt in the same visual bucket as a
 *     failing readiness probe.
 */

import type { Finding } from '@/lib/estate';

interface InjectionAlertProps {
  finding: Finding | null;
}

export const InjectionAlert = ({ finding }: InjectionAlertProps) => {
  const injections = finding?.injections_detected ?? [];
  if (injections.length === 0) return null;

  return (
    <section
      aria-labelledby="injection-heading"
      className="border-threat/40 border-y bg-threat/[0.05]"
    >
      <div className="flex flex-wrap items-center gap-2.5 px-3 pt-3.5 sm:px-5">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-threat" />
        <h2
          id="injection-heading"
          className="font-medium font-mono text-threat text-xs tracking-[0.14em] uppercase"
        >
          Injected instructions refused
        </h2>
        <span className="tnum font-mono text-[0.65rem] text-dim">
          {injections.length} {injections.length === 1 ? 'passage' : 'passages'}
        </span>
      </div>

      <p className="max-w-3xl px-3 pt-1.5 text-muted text-xs leading-relaxed sm:px-5">
        Text in this estate addressed the agent directly and tried to direct its actions. It was
        treated as evidence about the estate, not as instruction, and is reproduced here so you can
        see what was attempted. Nothing below was acted on.
      </p>

      <ul className="flex flex-col gap-2.5 p-3 sm:p-5">
        {injections.map((injection, i) => (
          <li
            key={`${injection.location}:${injection.quote.slice(0, 40)}`}
            className="row-in border border-threat/25 bg-ground"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-threat/20 border-b px-3 py-2">
              <span className="font-mono text-[0.7rem] text-threat">{injection.location}</span>
              <span className="eyebrow">found in estate content</span>
            </div>

            <blockquote className="quarantine px-3 py-2.5">
              <p className="whitespace-pre-wrap break-words font-mono text-[0.7rem] text-muted leading-relaxed">
                {injection.quote}
              </p>
            </blockquote>

            <div className="border-threat/20 border-t px-3 py-2">
              <span className="eyebrow">what it wanted</span>
              <p className="mt-0.5 text-ink text-xs leading-relaxed">{injection.demanded}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
