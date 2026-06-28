/**
 * Resolve box host from config (unified Caspar + HighAsCG on same machine).
 * Legacy `host` / `highascg_host` fields are still accepted.
 */

/**
 * @param {Record<string, unknown>} config
 * @returns {Record<string, unknown>}
 */
export function normalizeConnectionConfig(config) {
  const boxHost = getMainHost(config);
  return { ...config, box_host: boxHost };
}

/**
 * @param {Record<string, unknown>} config
 * @returns {string}
 */
export function getMainHost(config) {
  const raw =
    config?.box_host ?? config?.highascg_host ?? config?.host ?? "127.0.0.1";
  const host = String(raw).trim();
  return host || "127.0.0.1";
}

/**
 * @param {Record<string, unknown>} config
 * @returns {string | null}
 */
export function getBackupHost(config) {
  if (!config?.hot_backup_enabled) return null;
  const host = String(config?.backup_host ?? "").trim();
  return host || null;
}

/**
 * @param {Record<string, unknown>} config
 * @returns {number}
 */
export function getAmcpPort(config) {
  const port = Number(config?.port);
  return Number.isFinite(port) && port > 0 ? port : 5250;
}

/**
 * @param {Record<string, unknown>} config
 * @returns {number}
 */
export function getBridgePort(config) {
  const port = Number(config?.highascg_port);
  return Number.isFinite(port) && port > 0 ? port : 4200;
}
