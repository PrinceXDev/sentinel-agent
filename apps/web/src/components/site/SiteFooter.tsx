import Link from 'next/link';

import { FOOTER_BADGES, FOOTER_COLUMNS, SITE_REPO_URL } from '@/constants/site';

import { Sigil } from './SiteNav';

export const SiteFooter = () => {
  return (
    <footer className="border-line border-t bg-[#080b0e]">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <Sigil />
            <span className="font-mono font-medium text-[15px] text-ink">sentinel-agent</span>
          </div>
          <p className="mt-3 max-w-[30ch] text-[13.5px] text-dim leading-relaxed">
            Autonomous incident response, human-controlled execution. Built on the TrueForge agent
            harness.
          </p>
          <a
            href={SITE_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block font-mono text-[12px] text-steel underline-offset-4 hover:underline"
          >
            github.com/PrinceXDev/sentinel-agent →
          </a>
        </div>

        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="eyebrow">{col.title}</div>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13.5px] text-muted transition hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-line border-t">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-5 font-mono text-[11px] text-dim">
          {FOOTER_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
          <span className="ml-auto">The estate is simulated. The protocol traffic is not.</span>
        </div>
      </div>
    </footer>
  );
};
