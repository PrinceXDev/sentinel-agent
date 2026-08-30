/**
 * The console lives at `/console` and says so before the estate error appears.
 *
 * It needs a local harness, so on a deployed URL it reports the estate as
 * unavailable — correct, but indistinguishable from broken without the notice.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import Page, { metadata } from './page';

const html = renderToStaticMarkup(<Page />);

describe('/console', () => {
  it('renders the operator console', () => {
    expect(html).toContain('brief for the agent');
  });

  it('warns that it needs a local harness before the estate error lands', () => {
    expect(html).toContain('local only');
    expect(html).toMatch(/report the estate as unavailable/i);
  });

  it('links onward rather than leaving a visitor stuck', () => {
    expect(html).toContain('href="/docs/quickstart"');
    expect(html).toContain('href="/docs/tour"');
  });

  it('titles the page as the console', () => {
    expect(String(metadata.title)).toMatch(/operator console/i);
  });
});
