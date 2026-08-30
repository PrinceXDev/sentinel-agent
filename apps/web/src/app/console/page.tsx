import type { Metadata } from 'next';
import Link from 'next/link';

import { CommandCenter } from '@/components/CommandCenter';

/**
 * Deliberately not the site root: this needs a local harness, which a visitor
 * arriving at a deployed URL does not have.
 */
export const metadata: Metadata = {
  title: 'Operator console — sentinel-agent',
  description:
    'Live view of the harness investigating an incident, and the approval gate that holds it. Requires a local harness — see /docs/quickstart.',
};

/**
 * Static, not a connectivity check — it claims nothing about whether a harness
 * is running. It exists so the estate error below reads as expected, not broken.
 */
const LocalOnlyNotice = () => (
  <div className="border-line border-b bg-surface px-3 py-2.5 sm:px-5">
    <p className="max-w-3xl text-muted text-xs leading-relaxed">
      <span className="eyebrow mr-2">local only</span>
      This console reads a local ops server and a local TrueForge harness. Opened from a deployed
      URL it will report the estate as unavailable, which is correct rather than broken —{' '}
      <Link href="/docs/quickstart" className="text-steel underline underline-offset-2">
        run it locally
      </Link>{' '}
      to see it work, or take the{' '}
      <Link href="/docs/tour" className="text-steel underline underline-offset-2">
        guided tour
      </Link>{' '}
      for a walkthrough of a real run.
    </p>
  </div>
);

const Console = () => {
  return (
    <>
      <LocalOnlyNotice />
      <CommandCenter />
    </>
  );
};

export default Console;
