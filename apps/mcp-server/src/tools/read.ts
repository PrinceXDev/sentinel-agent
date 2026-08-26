/**
 * Read-only tools.
 *
 * All annotated `readOnlyHint: true`, so TrueForge lets the agent run them
 * autonomously and as often as it needs. Investigation should never require a
 * human to click anything — the gate belongs on the remediation, not the enquiry.
 */

import { z } from 'zod';
import { SERVICE } from '../domain/fixtures.js';
import { estate } from '../domain/store.js';
import { defineTool, failure, json } from './define.js';

const serviceArg = z.string().min(1).describe(`Service name, e.g. "${SERVICE}".`);

export const getIncident = defineTool({
  name: 'get_incident',
  title: 'Get incident',
  description:
    'Fetch one incident by id: title, severity, affected service, summary, detection source, ' +
    'current status, and any notes posted so far. Read-only.',
  risk: 'read',
  inputSchema: {
    incident_id: z.string().min(1).describe('Incident id, e.g. "INC-2048".'),
  },
  handler: ({ incident_id }) => {
    const incident = estate.getIncident(incident_id);
    if (!incident) return failure(`No incident with id ${incident_id}.`);
    return json(incident);
  },
});

export const listIncidents = defineTool({
  name: 'list_incidents',
  title: 'List incidents',
  description: 'List all known incidents, newest first. Read-only.',
  risk: 'read',
  inputSchema: {},
  handler: () => json({ incidents: estate.listIncidents() }),
});

export const getServiceHealth = defineTool({
  name: 'get_service_health',
  title: 'Get service health',
  description:
    'Current health of a service: overall status, which deployment is live, replica readiness, ' +
    'and per-check detail including upstream dependencies. Read-only.',
  risk: 'read',
  inputSchema: { service: serviceArg },
  handler: ({ service }) => {
    const health = estate.getHealth(service);
    if (!health) return failure(`No service named ${service}.`);
    return json(health);
  },
});

export const listRecentDeployments = defineTool({
  name: 'list_recent_deployments',
  title: 'List recent deployments',
  description:
    'Deployment history for a service, newest first: id, version, commit, author, message, ' +
    'timestamp, status, and changed file paths. Use this to find candidate change points. Read-only.',
  risk: 'read',
  inputSchema: {
    service: serviceArg,
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe('Maximum deployments to return. Defaults to 10.'),
  },
  handler: ({ service, limit }) => {
    const deployments = estate.listDeployments(service, limit);
    if (deployments.length === 0) return failure(`No deployments found for service ${service}.`);
    return json({ service, count: deployments.length, deployments });
  },
});

export const getDeployment = defineTool({
  name: 'get_deployment',
  title: 'Get deployment',
  description:
    'Full metadata for one deployment, including changed files and current status ' +
    '(live, superseded, or rolled_back). Read-only.',
  risk: 'read',
  inputSchema: {
    deployment_id: z.string().min(1).describe('Deployment id, e.g. "dpl-4c21".'),
  },
  handler: ({ deployment_id }) => {
    const deployment = estate.getDeployment(deployment_id);
    if (!deployment) return failure(`No deployment with id ${deployment_id}.`);
    return json(deployment);
  },
});

export const getDeploymentDiff = defineTool({
  name: 'get_deployment_diff',
  title: 'Get deployment diff',
  description:
    'Unified diff for a deployment. Use this to judge whether a change could plausibly cause an ' +
    'observed symptom, rather than inferring cause from timing alone. Read-only.',
  risk: 'read',
  inputSchema: {
    deployment_id: z.string().min(1).describe('Deployment id, e.g. "dpl-4c21".'),
  },
  handler: ({ deployment_id }) => {
    const deployment = estate.getDeployment(deployment_id);
    if (!deployment) return failure(`No deployment with id ${deployment_id}.`);
    return json({
      deployment_id: deployment.id,
      commit_sha: deployment.commit_sha,
      author: deployment.author,
      message: deployment.message,
      changed_files: deployment.changed_files,
      diff: deployment.diff,
    });
  },
});

export const exportMetricsCsv = defineTool({
  name: 'export_metrics_csv',
  title: 'Export service metrics as CSV',
  description:
    'Minute-resolution golden signals for a service as CSV: ts, p95_latency_ms, p50_latency_ms, ' +
    'error_rate, rps. Returns raw samples with no analysis — compute change points, ratios, and ' +
    'significance yourself in the sandbox. Also returns deploy_anchor, the timestamp of the ' +
    'currently-live deployment, as a candidate change point. Read-only.',
  risk: 'read',
  inputSchema: {
    service: serviceArg,
    from: z
      .string()
      .optional()
      .describe('Inclusive ISO 8601 lower bound. Omit for the start of the retained window.'),
    to: z
      .string()
      .optional()
      .describe('Inclusive ISO 8601 upper bound. Omit for the end of the retained window.'),
  },
  handler: ({ service, from, to }) => {
    const samples = estate.getMetrics(service, from, to);
    if (samples.length === 0) {
      return failure(`No metric samples for service ${service} in the requested window.`);
    }

    const header = 'ts,p95_latency_ms,p50_latency_ms,error_rate,rps';
    const rows = samples.map(
      (s) => `${s.ts},${s.p95_latency_ms},${s.p50_latency_ms},${s.error_rate},${s.rps}`,
    );

    return json({
      service,
      sample_count: samples.length,
      resolution: '1m',
      deploy_anchor: estate.deployAnchor(service),
      csv: [header, ...rows].join('\n'),
    });
  },
});

export const readTools = [
  getIncident,
  listIncidents,
  getServiceHealth,
  listRecentDeployments,
  getDeployment,
  getDeploymentDiff,
  exportMetricsCsv,
] as const;
