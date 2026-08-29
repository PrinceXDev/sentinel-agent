'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { DOCS_NAV } from '@/lib/site/docsNav';

export const DocSidebar = () => {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="space-y-8">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <div className="eyebrow px-3">{section.title}</div>
          <ul className="mt-3 space-y-0.5">
            {section.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-md px-3 py-1.5 text-[13.5px] transition ${
                      active
                        ? 'bg-steel/10 font-medium text-steel'
                        : 'text-muted hover:bg-surface hover:text-ink'
                    }`}
                  >
                    {page.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};
