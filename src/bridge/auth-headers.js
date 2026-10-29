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

/** Merge auth headers into an existing headers object. */
export function withAuth(headers, config) {
  return { ...(headers || {}), ...authHeaders(config) };
}
