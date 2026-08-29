'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Heading = { id: string; text: string; level: 2 | 3 };

/**
 * Table of contents built from the rendered article rather than declared per
 * page. A hand-maintained TOC drifts from the headings it points at the first
 * time someone renames a section; reading the DOM cannot.
 *
 * Scroll-spy uses IntersectionObserver against a band near the top of the
 * viewport, so the highlighted entry is the section you are reading rather than
 * the one that happens to be tallest.
 */
export const OnThisPage = () => {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(
      '#doc-article h2[id], #doc-article h3[id]',
    );
    const found: Heading[] = Array.from(nodes).map((n) => ({
      id: n.id,
      text: n.textContent ?? '',
      level: n.tagName === 'H3' ? 3 : 2,
    }));
    setHeadings(found);
    setActive(found[0]?.id ?? '');

    if (found.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 },
    );

    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
  }, []);

  // Re-scan when the route changes: the article is replaced, not remounted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the signal, not a value used inside
  useEffect(() => {
    setActive('');
  }, [pathname]);

  if (headings.length === 0) return null;

  return (
    <div className="sticky top-24">
      <div className="eyebrow">On this page</div>
      <ul className="mt-3 space-y-1.5 border-line border-l">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`-ml-px block border-l py-0.5 text-[12.5px] leading-snug transition ${
                h.level === 3 ? 'pl-6' : 'pl-3.5'
              } ${
                active === h.id
                  ? 'border-steel text-steel'
                  : 'border-transparent text-dim hover:text-muted'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
