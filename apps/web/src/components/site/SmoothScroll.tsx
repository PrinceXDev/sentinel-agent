'use client';

import gsap from 'gsap';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef } from 'react';

/**
 * GSAP ScrollSmoother wrapper.
 *
 * Deliberately scoped to the marketing page only. ScrollSmoother translates
 * `#smooth-content` rather than scrolling it, which means `position: sticky`
 * inside it never fires — and the docs shell is built on a sticky sidebar and a
 * sticky table of contents. So the docs use plain native scroll plus
 * ScrollTrigger reveals, and only the landing page gets the smoothing.
 *
 * Under `prefers-reduced-motion` no smoother is created at all: the page falls
 * back to ordinary browser scrolling, which is the correct behaviour rather
 * than a degraded one.
 */
export const SmoothScroll = ({ children }: { children: React.ReactNode }) => {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    const ctx = gsap.context(() => {
      ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.1,
        // Enables data-speed / data-lag on descendants.
        effects: true,
        smoothTouch: 0.1,
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div id="smooth-wrapper" ref={root}>
      <div id="smooth-content">{children}</div>
    </div>
  );
};
