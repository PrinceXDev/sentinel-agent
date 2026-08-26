/**
 * Structured line logger.
 *
 * One JSON object per line on stderr, so MCP's stdout stays clean and the output
 * is greppable while rehearsing a demo. No dependency, because a logging library
 * would be the largest thing in this server's tree.
 *
 * Never log tool arguments wholesale: an incident note could contain anything a
 * human typed. Log names, risk classes, and durations — the shape of what
 * happened, not its contents.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const threshold: number =
  LEVEL_ORDER[(process.env.LOG_LEVEL as Level | undefined) ?? 'info'] ?? LEVEL_ORDER.info;

function emit(level: Level, message: string, fields: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < threshold) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  });
  process.stderr.write(`${line}\n`);
}

export const logger = {
  debug: (message: string, fields: Record<string, unknown> = {}) => emit('debug', message, fields),
  info: (message: string, fields: Record<string, unknown> = {}) => emit('info', message, fields),
  warn: (message: string, fields: Record<string, unknown> = {}) => emit('warn', message, fields),
  error: (message: string, fields: Record<string, unknown> = {}) => emit('error', message, fields),
};
