/**
 * Teaches vitest the `@/` alias that `tsconfig.json` and Next already understand.
 *
 * Without it nothing importing `@/…` can be tested at all, which is why the page
 * components had no coverage: the convention that makes them readable also made
 * them unreachable from a test.
 */

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
