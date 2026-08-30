import type { Metadata } from 'next';
import Link from 'next/link';

import { CommandCenter } from '@/components/CommandCenter';

/**
 * The operator console.
 *
 * Deliberately not the site root. It needs a local ops MCP server, a running
 * TrueForge harness, a model provider and an operator token — none of which
 * exist for a visitor arriving at a deployed URL, so serving it as the landing
 * page meant a first impression of "estate unavailable". The overview lives at
 * `/` instead and this is linked from it.
 */
export const metadata: Metadata = {
  title: 'Operator console — sentinel-agent',
  description:
    'Live view of the harness investigating an incident, and the approval gate that holds it. Requires a local harness — see /docs/quickstart.',
};

/**
 * A static notice, not a connectivity check.
 *
 * On a deployed URL the estate is unreachable by construction, and the panels
 * below will say so. Saying it up front — before the reader concludes the
 * product is broken — costs one strip of chrome and is honest either way: it
 * makes no claim about whether a local harness is actually running.
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
