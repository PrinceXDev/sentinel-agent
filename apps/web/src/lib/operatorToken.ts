/**
 * Operator token: the credential that gates state-changing calls to the harness.
 *
 * ## The exposure this closes
 *
 * `/tf/[...path]` attaches the server-held `TRUEFORGE_TOKEN` to whatever it
 * forwards. That keeps the harness secret out of the browser — but it makes the
 * route itself the credential. Anything that can reach `:3000` could submit an
 * approval for a production rollback, with no credential of its own.
 *
 * A `Sec-Fetch-Site` check stops cross-origin *browser* requests, but browsers
 * are not the only caller: a local process running `curl` sends no
 * `Sec-Fetch-Site` at all. So reachability alone was sufficient authority.
 *
 * The operator token fixes that. Mutating requests must present a secret that is
 * **never sent to the browser by the server** — the operator supplies it once,
 * out of band, and it is held in `sessionStorage` for that tab only.
 *
 * ## What this does not fix, stated plainly
 *
 * A hostile process running **as the same OS user** can read `.env`, so it can
 * obtain the token. That is not solvable by any secret this app could hold: the
 * credential has to live somewhere, and same-user access reads it wherever it
 * lives. What the token does buy is that *reachability is no longer authority* —
 * a process must now deliberately go and read the operator's configuration
 * rather than simply POST to an open port.
 *
 * Genuine multi-operator authorisation needs an identity provider in front of the
 * UI and a rule about which humans may approve which actions. See
 * docs/architecture.md § Trust model.
 *
 * ## Why sessionStorage rather than a cookie
 *
 * A cookie is attached automatically, which is exactly what makes CSRF possible.
 * A value read from `sessionStorage` and set as an explicit header cannot be
 * attached by a request the page did not make. It is also per-tab and cleared on
 * close, so it does not outlive the session that entered it.
 */

/** Header carrying the operator token. */
export const OPERATOR_TOKEN_HEADER = 'x-sentinel-operator';

const STORAGE_KEY = 'sentinel-agent:operator-token';

export const loadOperatorToken = (): string | null => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing or storage disabled. The UI prompts again; nothing breaks.
    return null;
  }
};

export const saveOperatorToken = (token: string): void => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token.trim());
  } catch {
    // Non-fatal: the token still applies to this page's in-memory client.
  }
};

export const clearOperatorToken = (): void => {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing actionable.
  }
};
