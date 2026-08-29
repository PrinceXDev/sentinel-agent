import Link from 'next/link';

import { CALLOUT_TONE } from '@/constants/docKit';
import { adjacentPages } from '@/lib/site/docsNav';

/** Stable, readable anchor ids so the auto table of contents can link to them. */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

export const PageHeader = ({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) => {
  return (
    <header className="mb-12">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="mt-3 font-medium text-[clamp(2rem,4vw,2.9rem)] text-ink leading-[1.08] tracking-[-0.025em]">
        {title}
      </h1>
      <p className="mt-5 max-w-[64ch] text-[17px] text-muted leading-relaxed">{lead}</p>
    </header>
  );
};

export const H2 = ({ children }: { children: string }) => {
  return (
    <h2
      id={slugify(children)}
      className="mt-16 scroll-mt-24 border-line border-t pt-8 font-medium text-[clamp(1.35rem,2.4vw,1.75rem)] text-ink leading-tight tracking-[-0.02em]"
    >
      {children}
    </h2>
  );
};

export const H3 = ({ children }: { children: string }) => {
  return (
    <h3
      id={slugify(children)}
      className="mt-10 scroll-mt-24 font-medium text-[17px] text-ink leading-snug"
    >
      {children}
    </h3>
  );
};

export const P = ({ children }: { children: React.ReactNode }) => {
  return <p className="mt-4 max-w-[68ch] text-[15.5px] text-muted leading-[1.75]">{children}</p>;
};

export const Lead = ({ children }: { children: React.ReactNode }) => {
  return <p className="mt-5 max-w-[66ch] text-[17px] text-ink leading-[1.7]">{children}</p>;
};

export const UL = ({ children }: { children: React.ReactNode }) => {
  return (
    <ul className="mt-4 max-w-[68ch] space-y-2.5 text-[15.5px] text-muted leading-[1.7]">
      {children}
    </ul>
  );
};

export const LI = ({ children }: { children: React.ReactNode }) => {
  return (
    <li className="relative pl-5 before:absolute before:top-[0.72em] before:left-0 before:h-1 before:w-1 before:rounded-full before:bg-steel before:content-['']">
      {children}
    </li>
  );
};

export const C = ({ children }: { children: React.ReactNode }) => {
  return (
    <code className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[0.86em] text-ink">
      {children}
    </code>
  );
};

export const Callout = ({
  tone = 'note',
  title,
  children,
}: {
  tone?: keyof typeof CALLOUT_TONE;
  title?: string;
  children: React.ReactNode;
}) => {
  const t = CALLOUT_TONE[tone];
  return (
    <aside
      className="my-7 max-w-[70ch] rounded-r-lg border-l-2 py-4 pr-5 pl-5"
      style={{
        borderColor: t.color,
        background: `color-mix(in oklab, ${t.color} 6%, transparent)`,
      }}
    >
      <div
        className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
        style={{ color: t.color }}
      >
        {title ?? t.label}
      </div>
      <div className="mt-2 text-[14.5px] text-muted leading-[1.7]">{children}</div>
    </aside>
  );
};

export const Code = ({ children, lang }: { children: string; lang?: string }) => {
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-line bg-[#0d1216]">
      {lang ? (
        <div className="border-line border-b px-4 py-2 font-mono text-[10.5px] text-dim uppercase tracking-wider">
          {lang}
        </div>
      ) : null}
      <pre className="overflow-x-auto px-4 py-4">
        <code className="font-mono text-[12.5px] text-muted leading-[1.75]">{children}</code>
      </pre>
    </div>
  );
};

export const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => {
  return (
    <div className="my-7 overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-line border-b bg-surface">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-normal">
                <span className="eyebrow">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static doc tables, rows never reorder
            <tr key={i} className="border-line border-b last:border-0">
              {r.map((cell, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static doc tables, cells never reorder
                <td key={j} className="px-4 py-3 align-top text-muted">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Steps = ({ children }: { children: React.ReactNode }) => {
  return <ol className="mt-6 space-y-0">{children}</ol>;
};

export const Step = ({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <li className="relative border-line border-l pb-9 pl-8 last:border-transparent last:pb-0">
      <span className="-left-[13px] absolute top-0 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-raised font-mono text-[11px] text-steel">
        {n}
      </span>
      <h3 id={slugify(title)} className="scroll-mt-24 font-medium text-[16px] text-ink">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </li>
  );
};

/** A single big number with a caption. Used to anchor the reader in real values. */
export const Stat = ({
  value,
  label,
  tone = 'ink',
}: {
  value: string;
  label: string;
  tone?: 'ink' | 'ok' | 'danger' | 'gate' | 'steel';
}) => {
  const color = {
    ink: 'var(--color-ink)',
    ok: 'var(--color-ok)',
    danger: 'var(--color-danger)',
    gate: 'var(--color-gate)',
    steel: 'var(--color-steel)',
  }[tone];

  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-5">
      <div className="tnum font-mono font-medium text-[26px] leading-none" style={{ color }}>
        {value}
      </div>
      <div className="mt-2.5 text-[12.5px] text-dim leading-snug">{label}</div>
    </div>
  );
};

export const StatRow = ({ children }: { children: React.ReactNode }) => {
  return <div className="my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
};

export const PageNav = ({ href }: { href: string }) => {
  const { prev, next } = adjacentPages(href);
  return (
    <nav className="mt-20 grid gap-4 border-line border-t pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="rounded-xl border border-line bg-surface p-5 transition hover:border-line-strong"
        >
          <div className="eyebrow">← previous</div>
          <div className="mt-2 text-[15px] text-ink">{prev.label}</div>
          <div className="mt-1 text-[13px] text-dim">{prev.blurb}</div>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="rounded-xl border border-line bg-surface p-5 text-right transition hover:border-line-strong"
        >
          <div className="eyebrow">next →</div>
          <div className="mt-2 text-[15px] text-ink">{next.label}</div>
          <div className="mt-1 text-[13px] text-dim">{next.blurb}</div>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
};
