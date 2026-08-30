/**
 * Every internal link resolves to a route that exists.
 *
 * This PR moved the site's entry point — the console went from `/` to `/console`
 * and the overview took its place — and the failure mode of getting that wrong is
 * a 404 on a link nobody clicked before shipping. Three of them had to be updated
 * by hand across two constants files and a nav component.
 *
 * So the assertion is made against the filesystem rather than against a second
 * hand-written list: every `href` in the nav and footer is resolved to a
 * `page.tsx` under `src/app`. A renamed or deleted route fails here instead of in
 * a judge's browser.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FOOTER_COLUMNS, NAV_LINKS } from '../../constants/site';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');

/** Route paths the App Router will actually serve, derived from the tree. */
const routesOnDisk = (): Set<string> => {
  const found = new Set<string>();

  const walk = (dir: string, route: string): void => {
    if (existsSync(join(dir, 'page.tsx'))) found.add(route === '' ? '/' : route);

    for (const entry of readdirSync(dir)) {
      const child = join(dir, entry);
      if (!statSync(child).isDirectory()) continue;
      // Route groups and private folders do not contribute a path segment, and
      // dynamic segments cannot be matched against a static href.
      if (entry.startsWith('_') || entry.startsWith('(') || entry.startsWith('[')) continue;
      walk(child, `${route}/${entry}`);
    }
  };

  walk(APP_DIR, '');
  return found;
};

const internalHrefs = (): string[] => {
  const fromFooter = FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href));
  return [...NAV_LINKS.map((l) => l.href), ...fromFooter].filter((h) => h.startsWith('/'));
};

describe('site routes', () => {
  const routes = routesOnDisk();

  it('serves the overview at the root', () => {
    // The console used to live here. A visitor has no local harness, so the
    // landing page must not be something that reports "estate unavailable".
    expect(routes.has('/')).toBe(true);
  });

  it('serves the console at /console', () => {
    expect(routes.has('/console')).toBe(true);
  });

  it('keeps /product resolvable, so old links redirect rather than 404', () => {
    expect(routes.has('/product')).toBe(true);
  });

  it.each(internalHrefs())('nav or footer link %s resolves to a real route', (href) => {
    expect(routes.has(href)).toBe(true);
  });

  it('points the footer at the console rather than the root', () => {
    const productColumn = FOOTER_COLUMNS.find((c) => c.title === 'Product');
    const console = productColumn?.links.find((l) => l.label === 'Operator console');
    expect(console?.href).toBe('/console');
  });

  it('checks a meaningful number of links', () => {
    // Guards the guard: an empty or truncated constants export would make every
    // `it.each` above vacuous and the suite would still pass.
    expect(internalHrefs().length).toBeGreaterThanOrEqual(10);
  });
});
