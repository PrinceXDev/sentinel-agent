/**
 * Write tools — change non-production state.
 *
 * Annotated `readOnlyHint: false, destructiveHint: false`, which resolves to
 * TrueForge's `@write` tag and is therefore approval-gated under the default
 * policy. Posting an incident note is not dangerous, but it is *outward-facing*:
 * it lands in a record other engineers read during an incident. Gating it costs
 * one click and keeps the agent from narrating into a shared channel unprompted.
 */

import { z } from 'zod';

import { estate } from '../domain/store.js';
import { defineTool, failure, json } from './define.js';

export const postIncidentNote = defineTool({
  name: 'post_incident_note',
  title: 'Post incident note',
  description:
    'Append a note to an incident timeline. Other responders read this, so write findings ' +
    'and evidence rather than status chatter. Requires human approval before it is posted.',
  risk: 'write',
  inputSchema: {
    incident_id: z.string().min(1).describe('Incident id, e.g. "INC-2048".'),
    body: z
      .string()
      .min(1)
      .max(4000)
      .describe('Note text. State the finding and the evidence supporting it.'),
    author: z
      .string()
      .min(1)
      .default('sentinel-agent')
      .describe('Attribution for the note. Defaults to "sentinel-agent".'),
  },
  handler: ({ incident_id, body, author }) => {
    const incident = estate.addIncidentNote(incident_id, author, body);
    if (!incident) return failure(`No incident with id ${incident_id}.`);
    return json({
      posted: true,
      incident_id,
      note_count: incident.notes.length,
      note: incident.notes.at(-1),
    });
  },
});

export const writeTools = [postIncidentNote] as const;
