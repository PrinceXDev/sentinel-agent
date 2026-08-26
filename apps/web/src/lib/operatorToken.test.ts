/**
 * Operator token storage tests.
 *
 * Qodo finding #3 (High): the harness proxy attached its bearer token for any
 * caller, so reachability was authority — a local process could submit an
 * approval for a production rollback. The operator token is what makes a
 * state-changing call require a secret the server never sends to the browser.
 *
 * The storage layer is small but load-bearing: if a read throws in private
 * browsing and is not caught, the client's header supplier throws on every
 * request and nothing works at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearOperatorToken,
  loadOperatorToken,
  OPERATOR_TOKEN_HEADER,
  saveOperatorToken,
} from './operatorToken';

class MemoryStorage {
  #data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.#data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.#data.set(key, value);
  }
  removeItem(key: string): void {
    this.#data.delete(key);
  }
}

function useStorage(storage: unknown): void {
  vi.stubGlobal('window', { sessionStorage: storage });
}

beforeEach(() => {
  useStorage(new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('operator token storage', () => {
  it('returns null before anything is stored', () => {
    expect(loadOperatorToken()).toBeNull();
  });

  it('round-trips a token', () => {
    saveOperatorToken('abc-123');
    expect(loadOperatorToken()).toBe('abc-123');
  });

  it('trims surrounding whitespace, which a paste commonly carries', () => {
    saveOperatorToken('  abc-123\n');
    expect(loadOperatorToken()).toBe('abc-123');
  });

  it('clears a token', () => {
    saveOperatorToken('abc-123');
    clearOperatorToken();
    expect(loadOperatorToken()).toBeNull();
  });

  it('overwrites rather than appending', () => {
    saveOperatorToken('first');
    saveOperatorToken('second');
    expect(loadOperatorToken()).toBe('second');
  });
});

describe('when storage is unavailable', () => {
  // Private browsing and hardened settings make sessionStorage throw on access.
  // These must degrade to "no token", never propagate — the header supplier runs
  // on every request, so a throw here would break all traffic rather than just
  // mutations.
  const throwing = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('SecurityError');
    },
    removeItem() {
      throw new Error('SecurityError');
    },
  };

  beforeEach(() => {
    useStorage(throwing);
  });

  it('load returns null instead of throwing', () => {
    expect(() => loadOperatorToken()).not.toThrow();
    expect(loadOperatorToken()).toBeNull();
  });

  it('save does not throw', () => {
    expect(() => saveOperatorToken('abc')).not.toThrow();
  });

  it('clear does not throw', () => {
    expect(() => clearOperatorToken()).not.toThrow();
  });
});

describe('header name', () => {
  it('is a custom header, so a browser cannot attach it automatically', () => {
    // The point of a header over a cookie: cookies ride along on requests the
    // page never made, which is the CSRF mechanism. A custom header requires
    // script that has read the value.
    expect(OPERATOR_TOKEN_HEADER).toBe('x-sentinel-operator');
    expect(OPERATOR_TOKEN_HEADER.startsWith('x-')).toBe(true);
  });
});
