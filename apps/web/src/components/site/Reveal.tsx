'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef } from 'react';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds of stagger before this element starts. */
  delay?: number;
  /** Animate direct children in sequence instead of the element as a whole. */
  stagger?: boolean;
};

/**
 * Fade-and-rise on scroll entry.
 *
 * The initial hidden state is set from JS rather than CSS on purpose: if the
 * script never runs — no JS, a hydration failure, a crawler — the content is
 * already visible instead of permanently invisible.
 */
export const Reveal = ({ children, className, delay = 0, stagger = false }: RevealProps) => {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const targets = stagger ? Array.from(node.children) : [node];
      gsap.from(targets, {
        y: 26,
        opacity: 0,
        duration: 0.75,
        delay,
        ease: 'power2.out',
        stagger: stagger ? 0.09 : 0,
        scrollTrigger: { trigger: node, start: 'top 88%', once: true },
      });
    }, node);

    return () => ctx.revert();
  }, [delay, stagger]);

  return (
    <div ref={el} className={className}>
      {children}
    </div>
  );
};
