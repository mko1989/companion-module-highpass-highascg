/**
 * @file auth-headers.js
 * WO-811: shared-password auth for the HighAsCG HTTP API and WebSocket.
 * Empty password -> no header (server ignores auth while enforcement is off).
 */

/** @param {{api_password?: unknown}} [config] */
export function authHeaders(config) {
  const pw = String(config?.api_password ?? "").trim();
  return pw ? { Authorization: `Bearer ${pw}` } : {};
}

/**
 * Companion 5 hands `secret-text` fields to init/configUpdated in a separate `secrets` argument, never in `config`.
 * Folds the password back into the config the bridge reads.
 * @param {Record<string, unknown>} config
 * @param {{api_password?: unknown} | undefined} secrets
 */
export function withSecrets(config, secrets) {
  const pw = secrets?.api_password ?? config?.api_password ?? "";
  return { ...(config || {}), api_password: pw };
}

/** Merge auth headers into an existing headers object. */
export function withAuth(headers, config) {
  return { ...(headers || {}), ...authHeaders(config) };
}
