/**
 * Shell commands shown in more than one place — `npm run doctor` appears on
 * three pages, `npm run prove:gate` on two. A command used once stays inline
 * next to the prose that explains it.
 */

export interface ShellCommand {
  readonly command: string;
  readonly comment?: string;
}

export const CMD_DOCTOR: ShellCommand = {
  command: 'npm run doctor',
  comment: 'tells you which of the six things is missing',
};

export const CMD_PROVE_GATE: ShellCommand = {
  command: 'npm run prove:gate',
  comment: 'writes reports/gate-conformance.json, committed as evidence',
};

export const CMD_HARNESS: ShellCommand = {
  command: 'npx @truefoundry/trueforge@latest',
  comment: 'opens at http://localhost:8790',
};

export const CMD_CLONE: ShellCommand = {
  command: 'git clone https://github.com/PrinceXDev/sentinel-agent && npm install',
};
