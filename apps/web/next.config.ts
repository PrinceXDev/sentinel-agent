/**
 * Loads the repository-root `.env` before Next builds its own env.
 *
 * Next only reads `.env` from its project directory, which here is `apps/web` —
 * but the one `.env` this repo documents lives at the root, next to `doctor` and
 * `provision` which parse it themselves. Without this the web server saw no
 * `SENTINEL_MODEL` at all and `/api/agent-spec` returned 428, which reads as
 * "you did not set it" when in fact it was set somewhere Next never looked.
 *
 * Existing values win, so a real environment variable still overrides the file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const ROOT_ENV = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');

const loadRootEnv = (): void => {
  let raw: string;
  try {
    raw = readFileSync(ROOT_ENV, 'utf8');
  } catch {
    // Absent in CI and on Vercel, where the values arrive as real environment
    // variables. Missing is normal, not an error.
    return;
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value && process.env[key] === undefined) process.env[key] = value;
  }
};

loadRootEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Type errors must fail the build. Next's default already does this, but
  // stating it means a future `ignoreBuildErrors: true` needs a deliberate edit.
  typescript: { ignoreBuildErrors: false },
  // Next 16 removed the `eslint` config key — linting is no longer part of
  // `next build`. Biome covers it here, via `npm run lint` and `npm run ci`.
};

export default nextConfig;
