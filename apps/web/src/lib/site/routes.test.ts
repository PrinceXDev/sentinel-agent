/**
 * Covers `routes.ts`, and through it every internal link in the site chrome.
 *
 * This PR moved the site's entry point, and the failure mode of getting that
 * wrong is a 404 on a link nobody clicked before shipping.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { FOOTER_COLUMNS } from '@/constants/site';
import { internalHrefs, routesOnDisk } from './routes';

/** A throwaway `app`-shaped tree, so route resolution can be tested on shapes this repo lacks. */
const fixture = (dirs: string[]): string => {
  const root = mkdtempSync(join(tmpdir(), 'routes-'));
  for (const d of dirs) {
    const full = join(root, d);
    mkdirSync(full, { recursive: true });
    writeFileSync(join(full, 'page.tsx'), 'export default () => null;');
  }
  return root;
};

const temps: string[] = [];
const tree = (dirs: string[]): Set<string> => {
  const root = fixture(dirs);
  temps.push(root);
  return routesOnDisk(root);
};

afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});

describe('routesOnDisk', () => {
  it('maps nested directories to their path', () => {
    expect(tree(['docs/tour'])).toEqual(new Set(['/docs/tour']));
  });

  it('treats a route group as contributing no path segment', () => {
    // Qodo (Bug): parenthesised directories were skipped outright, so a page
    // inside a group was invisible and a valid link would read as broken.
    expect(tree(['(marketing)/about'])).toEqual(new Set(['/about']));
  });

  it('resolves a page directly inside a route group to the parent path', () => {
    expect(tree(['(marketing)'])).toEqual(new Set(['/']));
  });

  it('ignores private folders and dynamic segments', () => {
    // `_internal` is never routed; `[slug]` cannot be matched against a static href.
    expect(tree(['_internal/thing', '[slug]'])).toEqual(new Set());
  });
});

describe('site routes', () => {
  const routes = routesOnDisk();

  it('serves the overview at the root', () => {
    // The console used to live here, and a visitor has no local harness.
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
    // Guards the guard: a truncated constants export would make every `it.each`
    // above vacuous and the suite would still pass.
    expect(internalHrefs().length).toBeGreaterThanOrEqual(10);
  });
});
