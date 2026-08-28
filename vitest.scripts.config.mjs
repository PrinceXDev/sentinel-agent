import { defineConfig } from 'vitest/config';

/**
 * Root-level tests for `scripts/`.
 *
 * Deliberately NOT named `vitest.config.mjs`. Vitest walks up from its working
 * directory to find a config, and neither workspace under `apps/` has one of its
 * own — so a root config with that name is inherited by both, overrides their
 * `include`, and they exit 1 with "No test files found". Naming it out of the
 * auto-discovery pattern and passing `--config` explicitly keeps the three test
 * runs independent.
 *
 * The workspaces under `apps/` each own their vitest run; this config covers the
 * scripts, which belong to no workspace but contain the Gate Prover's verdict
 * logic — the code that decides whether the approval gate held.
 *
 * That logic went untested until Qodo's review of PR #4 found two bugs in it,
 * both invisible to a live run because each needed unrelated traffic in the same
 * session to reproduce. Four clean conformance runs missed them. Extracting the
 * oracles into `scripts/lib/` and testing them here is the response.
 */
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
