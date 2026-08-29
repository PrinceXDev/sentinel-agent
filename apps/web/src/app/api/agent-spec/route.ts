/**
 * Serves the agent spec to the browser, with the model name resolved from env.
 *
 * The spec is imported from `agent/sentinel-agent.agent.json` rather than
 * duplicated in TypeScript, so there is exactly one definition of the agent's
 * approval policy. A second copy in the frontend would be a copy that drifts,
 * and the field most likely to drift is `require_approval_for_tools`.
 *
 * It is a **static import**, not an `fs.readFile`. Reading it at request time
 * makes Next trace the route as filesystem-dependent and bundle the entire
 * project — source tree and public folder included — into the server output. A
 * static import gets the same single source of truth with none of that, and is
 * resolved at build time so a malformed spec fails the build rather than the
 * first request.
 *
 * The model name is substituted from `SENTINEL_MODEL` because the committed spec
 * holds the placeholder `REPLACE_WITH_YOUR_MODEL` — a real model id in a public
 * repo is a config detail nobody else can use.
 */

import rawSpec from '@agent/sentinel-agent.agent.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MODEL_PLACEHOLDER = 'REPLACE_WITH_YOUR_MODEL';

interface AgentSpec {
  model: { name: string; params?: Record<string, unknown> };
  instructions?: string;
  mcp_servers?: unknown[];
  skills?: unknown[];
  config?: Record<string, unknown>;
}

const spec = rawSpec as AgentSpec;

export const GET = (): Response => {
  const model = process.env.SENTINEL_MODEL?.trim();

  if (!model) {
    // Fail with instructions rather than sending the placeholder upstream, where
    // it becomes an opaque 422 from the harness about an unresolvable model.
    return Response.json(
      {
        error: 'model_not_configured',
        message:
          'Set SENTINEL_MODEL to a model configured in the harness, e.g. SENTINEL_MODEL=anthropic/claude-sonnet-4-6',
      },
      { status: 428 },
    );
  }

  // The committed spec should hold the placeholder. If someone hardcoded a real
  // model, env still wins — but say so, because a silent override is worse than
  // a noisy one.
  const overrodeSpecModel = Boolean(spec.model?.name && spec.model.name !== MODEL_PLACEHOLDER);

  return Response.json({
    spec: { ...spec, model: { ...spec.model, name: model } },
    ...(overrodeSpecModel ? { overrodeSpecModel } : {}),
  });
};
