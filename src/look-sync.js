/**
 * Merge look lists from live deck sync + saved project for Companion presets/actions.
 */

import { normalizeMainScope } from "./look-scope.js";
import { pickRicherLookScene } from "./scene-payload.js";

/**
 * @param {unknown} x
 * @returns {{ id: string, name: string, thumbnail: unknown, mainScope: string } | null}
 */
function normalizeLookMeta(x) {
  if (!x || x.id == null || !String(x.id).trim()) return null;
  return {
    id: String(x.id).trim(),
    name: String(x.name || "Look").slice(0, 120),
    thumbnail: x.thumbnail || x.thumb || x.image || x.previewImage || null,
    mainScope: normalizeMainScope(x.mainScope),
  };
}

/**
 * Look id/name/thumbnail from full scene objects (deck `sceneSnapshots` or project scenes).
 * @param {unknown[]} snapshots
 * @returns {{ id: string, name: string, thumbnail: unknown }[]}
 */
function lookMetadataFromSnapshots(snapshots) {
  if (!Array.isArray(snapshots)) return [];
  const out = [];
  for (const raw of snapshots) {
    const m = normalizeLookMeta(raw);
    if (m) out.push(m);
  }
  return out;
}

/**
 * Union look metadata from multiple sources (later lists win on id collision).
 * @param {...unknown[]} lookLists
 * @returns {{ id: string, name: string, thumbnail: unknown, mainScope: string }[]}
 */
function mergeLookMetadata(...lookLists) {
  const byId = new Map();
  for (const list of lookLists) {
    for (const raw of list || []) {
      const m = normalizeLookMeta(raw);
      if (m) byId.set(m.id, { ...byId.get(m.id), ...m });
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/**
 * Prefer scene snapshot names over deck metadata list (snapshots carry live renames).
 *
 * @param {object | null | undefined} deck
 */
function mergeDeckNamesFromSnapshots(deck) {
  if (!deck || typeof deck !== "object") return deck;
  const snaps = Array.isArray(deck.sceneSnapshots) ? deck.sceneSnapshots : [];
  if (!snaps.length) return deck;
  const snapById = new Map(
    snaps
      .map((s) => {
        const id = String(s?.id ?? "").trim();
        const name = String(s?.name ?? "").trim();
        return id && name ? [id, name] : null;
      })
      .filter(Boolean),
  );
  if (!snapById.size) return deck;
  let looks = deck.looks;
  if (Array.isArray(looks)) {
    looks = looks.map((raw) => {
      const id = String(raw?.id ?? "").trim();
      const snapName = snapById.get(id);
      return snapName ? { ...raw, name: snapName } : raw;
    });
  }
  const sceneSnapshots = snaps.map((raw) => {
    const id = String(raw?.id ?? "").trim();
    const snapName = snapById.get(id);
    return snapName ? { ...raw, name: snapName } : raw;
  });
  return { ...deck, looks, sceneSnapshots };
}

/**
 * Refresh look names in a cached deck payload from saved project metadata.
 *
 * @param {object | null | undefined} deck
 * @param {Array<{ id: string, name?: string, mainScope?: string }>} projectLooks
 */
function refreshDeckLookNamesFromProject(deck, projectLooks) {
  if (!deck || typeof deck !== "object" || !Array.isArray(deck.looks)) {
    return deck;
  }
  const byId = new Map(
    (projectLooks || []).map((l) => [String(l.id).trim(), l]),
  );
  const looks = deck.looks.map((raw) => {
    const id = String(raw?.id ?? "").trim();
    if (!id) return raw;
    const proj = byId.get(id);
    if (!proj) return raw;
    return {
      ...raw,
      name: proj.name ?? raw.name,
      mainScope: proj.mainScope ?? raw.mainScope,
    };
  });
  let sceneSnapshots = deck.sceneSnapshots;
  if (Array.isArray(sceneSnapshots)) {
    sceneSnapshots = sceneSnapshots.map((raw) => {
      const id = String(raw?.id ?? "").trim();
      if (!id) return raw;
      const proj = byId.get(id);
      return proj ? { ...raw, name: proj.name ?? raw.name } : raw;
    });
  }
  return { ...deck, looks, sceneSnapshots };
}

/**
 * Build Companion preset/action look list.
 * Live deck `looks` is authoritative when present; otherwise use saved project looks.
 * Stale deck snapshots alone cannot resurrect deleted looks.
 *
 * @param {unknown[]} projectLooks
 * @param {{ looks?: unknown[], sceneSnapshots?: unknown[] } | null | undefined} deck
 */
function buildPresetLooks(projectLooks, deck) {
  const project = (projectLooks || [])
    .map((raw) => normalizeLookMeta(raw))
    .filter(Boolean);
  const projectById = new Map(project.map((l) => [l.id, l]));
  const snapById = new Map(
    lookMetadataFromSnapshots(deck?.sceneSnapshots).map((s) => [s.id, s]),
  );

  const deckLooks = (Array.isArray(deck?.looks) ? deck.looks : [])
    .map((raw) => normalizeLookMeta(raw))
    .filter(Boolean);

  if (deckLooks.length > 0) {
    const out = [];
    const seen = new Set();
    for (const m of deckLooks) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const proj = projectById.get(m.id);
      const snap = snapById.get(m.id);
      const name = String(
        snap?.name || m.name || proj?.name || "Look",
      ).slice(0, 120);
      out.push({
        ...proj,
        ...snap,
        ...m,
        id: m.id,
        name,
        thumbnail: snap?.thumbnail ?? proj?.thumbnail ?? m.thumbnail ?? null,
        mainScope: m.mainScope ?? snap?.mainScope ?? proj?.mainScope ?? "all",
      });
    }
    return out.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }

  return project.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/**
 * Remove looks from a cached deck payload that no longer exist in the project.
 *
 * @param {object | null | undefined} deck
 * @param {Set<string>} validIds
 */
function pruneDeckToSceneIds(deck, validIds) {
  if (!deck || typeof deck !== "object") return deck;
  if (!(validIds instanceof Set)) return deck;
  /** @type {Record<string, unknown>} */
  const next = { ...deck };
  if (Array.isArray(next.looks)) {
    next.looks = next.looks.filter(
      (l) => l && validIds.has(String(/** @type {{ id?: unknown }} */ (l).id).trim()),
    );
  }
  if (Array.isArray(next.sceneSnapshots)) {
    next.sceneSnapshots = next.sceneSnapshots.filter(
      (s) => s && validIds.has(String(/** @type {{ id?: unknown }} */ (s).id).trim()),
    );
  }
  const prv = next.previewSceneId;
  if (prv != null && String(prv).trim() && !validIds.has(String(prv).trim())) {
    next.previewSceneId = null;
  }
  return next;
}

/**
 * Scene payloads for take/cue, limited to current look ids.
 *
 * @param {{ sceneSnapshots?: unknown } | null | undefined} deck
 * @param {unknown[]} projectScenes
 * @param {Set<string>} validLookIds
 */
function buildDeckSceneById(deck, projectScenes, validLookIds) {
  const valid =
    validLookIds instanceof Set ? validLookIds : new Set(validLookIds || []);
  const fromDeck = snapshotsFromDeck(deck);
  const filteredDeck = new Map();
  for (const [id, scene] of fromDeck) {
    if (valid.has(id)) filteredDeck.set(id, scene);
  }
  const filteredProject = (projectScenes || []).filter(
    (s) =>
      s &&
      typeof s === "object" &&
      s.id != null &&
      valid.has(String(s.id).trim()),
  );
  return mergeSceneSnapshotMaps(filteredDeck, filteredProject);
}

/**
 * @param {Map<string, object>} deckMap
 * @param {unknown[]} projectScenes — full scene objects from GET /api/project
 * @returns {Map<string, object>}
 */
function mergeSceneSnapshotMaps(deckMap, projectScenes) {
  const map = new Map(deckMap || []);
  for (const s of projectScenes || []) {
    if (!s || typeof s !== "object" || s.id == null) continue;
    const id = String(s.id).trim();
    if (!id) continue;
    const existing = map.get(id);
    map.set(id, existing ? pickRicherLookScene(existing, s) : s);
  }
  return map;
}

/**
 * @param {{ sceneSnapshots?: unknown } | null | undefined} deck
 * @returns {Map<string, object>}
 */
function snapshotsFromDeck(deck) {
  const map = new Map();
  if (!deck || typeof deck !== "object") return map;
  if (Array.isArray(deck.sceneSnapshots)) {
    for (const s of deck.sceneSnapshots) {
      if (s && typeof s === "object" && s.id != null && String(s.id).trim()) {
        map.set(String(s.id).trim(), s);
      }
    }
  }
  return map;
}

export {
  normalizeLookMeta,
  lookMetadataFromSnapshots,
  mergeLookMetadata,
  mergeDeckNamesFromSnapshots,
  refreshDeckLookNamesFromProject,
  buildPresetLooks,
  pruneDeckToSceneIds,
  buildDeckSceneById,
  mergeSceneSnapshotMaps,
  snapshotsFromDeck,
};
