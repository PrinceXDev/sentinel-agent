/**
 * The root route serves the overview, not the console.
 *
 * That swap is the behaviour this test exists for: both are valid pages, so
 * putting the wrong one here compiles, builds, and deploys without complaint.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import Page, { metadata } from './page';

const html = renderToStaticMarkup(<Page />);

describe('/', () => {
  it('renders the product overview', () => {
    expect(html).toContain('Autonomous incident response');
    expect(html).toContain('human-controlled execution');
  });

  it('is not the operator console', () => {
    // The console's own chrome. A visitor has no local harness, so landing on
    // "estate unavailable" would be the first thing they saw.
    expect(html).not.toContain('brief for the agent');
    expect(html).not.toContain('ESTATE UNAVAILABLE');
  });

  it('offers a way into the console rather than being it', () => {
    expect(html).toContain('href="/console"');
  });

  it('states the annotation coverage the ops server actually publishes', () => {
    // Qodo (Bug, PR #7): this said 10/10 while the footer said 13/13.
    expect(html).toContain('13/13');
    expect(html).not.toContain('10/10');
  });

  it('titles the page as the overview', () => {
    expect(String(metadata.title)).toMatch(/autonomous incident response/i);
  });
});
