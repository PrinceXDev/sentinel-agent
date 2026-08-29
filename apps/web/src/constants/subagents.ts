/** The three investigation roles the incident-response skill specifies for subagents. */
export const SUBAGENT_ROLES = [
  {
    name: 'performance-investigator',
    brief: 'Characterise the symptom.',
    body: 'When did it start, how big is it, and which signals moved together? Computes onset and magnitude from raw samples rather than describing the shape of a graph.',
    returns: 'Onset timestamp, settled ratio, and which golden signals did and did not move.',
  },
  {
    name: 'deployment-investigator',
    brief: 'Enumerate the changes.',
    body: 'Every deployment in a generous window — generous on purpose, because a window drawn tightly around the incident is a window that assumes the answer. Rules candidates in or out on timing alone.',
    returns: 'A ranked candidate list with a timing verdict for each, and nothing about mechanism.',
  },
  {
    name: 'code-investigator',
    brief: 'Explain the mechanism.',
    body: 'Reads the diffs of the timing-plausible candidates only, and assesses whether the change could produce the observed shape. A timing correlation without a mechanism is not a root cause.',
    returns: 'For each candidate: a mechanism, or an explicit "no plausible mechanism".',
  },
];
