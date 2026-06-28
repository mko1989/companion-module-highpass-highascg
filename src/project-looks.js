/**
 * Normalize look/scene lists from HighAsCG API payloads (shape varies by version/route).
 */

/**
 * @param {unknown} x
 * @returns {object[]}
 */
function asSceneArray(x) {
  if (!Array.isArray(x)) return [];
  return x.filter((s) => s && typeof s === "object" && s.id != null);
}

/**
 * Extract look scene objects from GET/POST /api/project bodies.
 * @param {unknown} project
 * @returns {object[]}
 */
function extractProjectScenes(project) {
  if (!project || typeof project !== "object") return [];

  const candidates = [
    /** @type {unknown} */ (project).scenes?.scenes,
    /** @type {unknown} */ (project).scenes,
    /** @type {unknown} */ (project).web_project?.scenes?.scenes,
    /** @type {unknown} */ (project).web_project?.scenes,
    /** @type {unknown} */ (project).project?.scenes?.scenes,
    /** @type {unknown} */ (project).project?.scenes,
    /** @type {unknown} */ (project).bundle?.scenes?.scenes,
    /** @type {unknown} */ (project).bundle?.scenes,
    /** @type {unknown} */ (project).looks,
    /** @type {unknown} */ (project).data?.scenes?.scenes,
    /** @type {unknown} */ (project).data?.scenes,
  ];

  for (const c of candidates) {
    const arr = asSceneArray(c);
    if (arr.length > 0) return arr;
  }
  return [];
}

/**
 * Extract companion deck payload from GET /api/state or WS change value.
 * @param {unknown} stateOrDeck
 * @returns {{ looks?: unknown[], sceneSnapshots?: unknown[], previewSceneId?: unknown } | null}
 */
function extractSceneDeck(stateOrDeck) {
  if (!stateOrDeck || typeof stateOrDeck !== "object") return null;

  /** @type {Record<string, unknown>} */
  const o = stateOrDeck;

  if (Array.isArray(o.looks) || Array.isArray(o.sceneSnapshots)) {
    return o;
  }

  const nested =
    o.scene?.deck ??
    o.scene_deck ??
    o.deck ??
    null;

  if (nested && typeof nested === "object") {
    return nested;
  }

  return null;
}

/**
 * Union scene arrays by id (later entries win on collision).
 * @param {...object[][]} lists
 * @returns {object[]}
 */
function unionScenesById(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const s of list || []) {
      if (!s || s.id == null) continue;
      const id = String(s.id).trim();
      if (!id) continue;
      byId.set(id, { ...byId.get(id), ...s });
    }
  }
  return Array.from(byId.values());
}

export { extractProjectScenes, extractSceneDeck, unionScenesById };
