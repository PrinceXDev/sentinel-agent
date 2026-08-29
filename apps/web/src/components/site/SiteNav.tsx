import Link from 'next/link';

import { NAV_LINKS, SITE_REPO_URL } from '@/constants/site';

export const SiteNav = ({ variant = 'floating' }: { variant?: 'floating' | 'docked' }) => {
  return (
    <header
      className={
        variant === 'docked'
          ? 'sticky top-0 z-50 border-line border-b bg-ground/85 backdrop-blur-md'
          : 'absolute inset-x-0 top-0 z-50'
      }
    >
      <nav className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-6">
        <Link href="/product" className="flex items-center gap-2.5">
          <Sigil />
          <span className="font-mono font-medium text-[15px] text-ink tracking-tight">
            sentinel<span className="text-dim">-agent</span>
          </span>
        </Link>

        <div className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded px-3 py-2 text-[13.5px] text-muted transition hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={SITE_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded px-3 py-2 text-[13.5px] text-muted transition hover:text-ink sm:block"
          >
            GitHub
          </a>
          <Link
            href="/"
            className="rounded-md border border-steel-dim bg-steel/10 px-3.5 py-2 font-medium text-[13.5px] text-steel transition hover:bg-steel/20"
          >
            Open console
          </Link>
        </div>
      </nav>
    </header>
  );
};

/** A shield split by a horizontal rule — the gate, drawn small. */
export const Sigil = ({ size = 22 }: { size?: number }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <title>sentinel-agent</title>
      <path
        d="M12 2.5 20 5.5v6.2c0 4.9-3.3 8.6-8 9.8-4.7-1.2-8-4.9-8-9.8V5.5L12 2.5Z"
        stroke="var(--color-steel)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M4.6 12.2h14.8" stroke="var(--color-gate)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="12.2" r="1.9" fill="var(--color-gate)" />
    </svg>
  );
};
