/**
 * Resolves the paths the App Router will actually serve, by walking `src/app`.
 *
 * Derived from the filesystem rather than a hand-written list, so a renamed or
 * deleted route cannot silently disagree with the nav and footer that link to it.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Relative rather than the `@/` alias: this module is covered by a test, and
// vitest resolves no path aliases here.
import { FOOTER_COLUMNS, NAV_LINKS } from '../../constants/site';

export const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');

/**
 * Directories that contribute no URL segment but still contain routable pages.
 *
 * Route groups — `(marketing)` — are the reason this is a separate concept from
 * "skip". Skipping them entirely made a page inside one invisible to the walk,
 * so a perfectly valid link would have been reported as broken.
 */
const isRouteGroup = (entry: string): boolean => entry.startsWith('(') && entry.endsWith(')');

/** Directories that are not routes at all: private folders and dynamic segments. */
const isNotRoutable = (entry: string): boolean => entry.startsWith('_') || entry.startsWith('[');

/** Child directories worth descending into, paired with the path each carries. */
const routableChildren = (dir: string, route: string): { dir: string; route: string }[] =>
  readdirSync(dir)
    .filter((entry) => !isNotRoutable(entry) && statSync(join(dir, entry)).isDirectory())
    // A route group keeps the parent's path; everything else appends a segment.
    .map((entry) => ({
      dir: join(dir, entry),
      route: isRouteGroup(entry) ? route : `${route}/${entry}`,
    }));

export const routesOnDisk = (appDir: string = APP_DIR): Set<string> => {
  const found = new Set<string>();

  const walk = (dir: string, route: string): void => {
    if (existsSync(join(dir, 'page.tsx'))) found.add(route === '' ? '/' : route);
    for (const child of routableChildren(dir, route)) walk(child.dir, child.route);
  };

  walk(appDir, '');
  return found;
};

/** Every in-app `href` the site chrome links to. External links are excluded. */
export const internalHrefs = (): string[] => {
  const fromFooter = FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href));
  return [...NAV_LINKS.map((l) => l.href), ...fromFooter].filter((h) => h.startsWith('/'));
};
