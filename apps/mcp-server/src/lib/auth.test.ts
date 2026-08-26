/**
 * Tests for MCP transport authentication.
 *
 * Qodo flagged (High) that the MCP server listened on all interfaces and executed
 * `/mcp` requests unauthenticated, so `rollback_deployment` could be invoked
 * directly — never reaching the harness, and therefore never reaching the
 * approval gate the whole project is built around.
 *
 * `OPS_MCP_TOKEN` is read at module load, so each posture needs a fresh module
 * instance via `vi.resetModules()` and a dynamic import.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL = process.env.OPS_MCP_TOKEN;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.OPS_MCP_TOKEN;
  else process.env.OPS_MCP_TOKEN = ORIGINAL;
  vi.resetModules();
});

async function loadWithToken(token: string | undefined) {
  if (token === undefined) delete process.env.OPS_MCP_TOKEN;
  else process.env.OPS_MCP_TOKEN = token;
  vi.resetModules();
  return import('./auth.js');
}

describe('checkMcpAuth with no token configured', () => {
  it('allows any request, because loopback binding is the only control', async () => {
    const { checkMcpAuth } = await loadWithToken(undefined);
    expect(checkMcpAuth(undefined)).toBeNull();
    expect(checkMcpAuth('Bearer anything')).toBeNull();
  });
});

describe('checkMcpAuth with a token configured', () => {
  const TOKEN = 's3cret-ops-token';

  it('allows a correct bearer token', async () => {
    const { checkMcpAuth } = await loadWithToken(TOKEN);
    expect(checkMcpAuth(`Bearer ${TOKEN}`)).toBeNull();
  });

  it('accepts a case-insensitive scheme', async () => {
    const { checkMcpAuth } = await loadWithToken(TOKEN);
    expect(checkMcpAuth(`bearer ${TOKEN}`)).toBeNull();
  });

  it('rejects a missing header', async () => {
    const { checkMcpAuth } = await loadWithToken(TOKEN);
    expect(checkMcpAuth(undefined)).toBe('missing_authorization_header');
  });

  it('rejects a wrong token', async () => {
    const { checkMcpAuth } = await loadWithToken(TOKEN);
    expect(checkMcpAuth('Bearer wrong-token-here')).toBe('token_mismatch');
  });

  it('rejects a token of a different length without throwing', async () => {
    // timingSafeEqual throws on length mismatch; the guard must handle it.
    const { checkMcpAuth } = await loadWithToken(TOKEN);
    expect(checkMcpAuth('Bearer short')).toBe('token_mismatch');
  });

  it('rejects a non-bearer scheme', async () => {
    const { checkMcpAuth } = await loadWithToken(TOKEN);
    expect(checkMcpAuth(`Basic ${TOKEN}`)).toBe('unsupported_auth_scheme');
  });

  it('rejects an empty bearer value', async () => {
    const { checkMcpAuth } = await loadWithToken(TOKEN);
    expect(checkMcpAuth('Bearer ')).toBe('empty_bearer_token');
  });
});

describe('reportPosture', () => {
  it('reports loopback for 127.0.0.1', async () => {
    const { reportPosture } = await loadWithToken(undefined);
    expect(reportPosture('127.0.0.1').loopbackOnly).toBe(true);
  });

  it('reports non-loopback for a wildcard bind', async () => {
    const { reportPosture } = await loadWithToken('t');
    const posture = reportPosture('0.0.0.0');
    expect(posture.loopbackOnly).toBe(false);
    expect(posture.tokenRequired).toBe(true);
  });

  it('flags the insecure combination: off-loopback with no token', async () => {
    const { reportPosture } = await loadWithToken(undefined);
    const posture = reportPosture('0.0.0.0');
    expect(posture.loopbackOnly).toBe(false);
    expect(posture.tokenRequired).toBe(false);
  });
});
