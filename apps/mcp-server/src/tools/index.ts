/** The complete tool registry. Anything not in this array is not reachable. */

import type { RegisterableTool } from './define.js';
import { destructiveTools } from './destructive.js';
import { findingTools } from './findings.js';
import { previewTools } from './preview.js';
import { readTools } from './read.js';
import { writeTools } from './write.js';

export const allTools: readonly RegisterableTool[] = [
  ...readTools,
  ...previewTools,
  ...writeTools,
  ...findingTools,
  ...destructiveTools,
];

export type { RegisterableTool } from './define.js';
export { PRODUCTION_MUTATING_TOOLS } from './destructive.js';
