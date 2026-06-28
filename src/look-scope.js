/**
 * Look mainScope helpers — HighAsCG scopes looks to screen destinations via mainScope.
 */

/** @param {unknown} mainScope */
function normalizeMainScope(mainScope) {
  if (mainScope == null || String(mainScope).trim() === "") return "all";
  return String(mainScope).trim();
}

/**
 * @param {{ mainScope?: unknown } | null | undefined} look
 * @param {number} screenIndex — 0-based main / screen index
 */
function lookMatchesScreen(look, screenIndex) {
  const scope = normalizeMainScope(look?.mainScope);
  if (scope === "all") return true;
  const idx = Math.max(0, parseInt(screenIndex, 10) || 0);
  return scope === String(idx);
}

/**
 * @param {Array<{ mainScope?: unknown }>} looks
 * @param {number} screenIndex
 */
function filterLooksForScreen(looks, screenIndex) {
  if (!Array.isArray(looks)) return [];
  return looks.filter((l) => lookMatchesScreen(l, screenIndex));
}

/**
 * @param {unknown} mainScope
 * @returns {string}
 */
function mainScopeShortLabel(mainScope) {
  const scope = normalizeMainScope(mainScope);
  if (scope === "all") return "All";
  const n = parseInt(scope, 10);
  return Number.isFinite(n) && n >= 0 ? `Scr ${n + 1}` : scope;
}

/**
 * @param {{ mainScope?: unknown } | null | undefined} lookMeta
 * @param {{ mainScope?: unknown } | null | undefined} scene
 * @param {number} buttonScreenIndex — screen tab / action option (0-based)
 * @returns {number}
 */
function resolveLookTargetScreen(lookMeta, scene, buttonScreenIndex) {
  const scope = normalizeMainScope(lookMeta?.mainScope ?? scene?.mainScope);
  if (scope === "all") {
    return Math.max(0, parseInt(buttonScreenIndex, 10) || 0);
  }
  return Math.max(0, parseInt(scope, 10) || 0);
}

export {
  normalizeMainScope,
  lookMatchesScreen,
  filterLooksForScreen,
  mainScopeShortLabel,
  resolveLookTargetScreen,
};
