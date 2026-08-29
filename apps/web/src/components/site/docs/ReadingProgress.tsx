'use client';

import { useEffect, useState } from 'react';

/**
 * A one-pixel progress rule under the docs nav.
 *
 * Cheap, but it is the difference between "this page is long" and "this page is
 * long and I am nearly through it", which is most of what makes long reference
 * pages tolerable.
 */
export const ReadingProgress = () => {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setPct(scrollable <= 0 ? 0 : Math.min(100, (doc.scrollTop / scrollable) * 100));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div aria-hidden className="-bottom-px absolute inset-x-0 h-px bg-transparent">
      <div
        className="h-px bg-steel transition-[width] duration-100 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
