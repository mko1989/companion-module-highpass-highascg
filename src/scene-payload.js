import { extractProjectScenes } from "./project-looks.js";

/**
 * Layer has a real Caspar-loadable source (not a UI placeholder).
 *
 * @param {unknown} layer
 * @returns {boolean}
 */
function layerIsTakeable(layer) {
  if (!layer || typeof layer !== "object") return false;
  const src = /** @type {{ value?: unknown, isPlaceholder?: boolean, type?: string }} */ (
    layer
  ).source;
  if (!src?.value) return false;
  if (src.isPlaceholder) return false;
  if (String(src.type || "").toLowerCase() === "placeholder") return false;
  return true;
}

/**
 * @param {unknown} scene
 * @returns {boolean}
 */
function sceneHasTakeableLayers(scene) {
  if (!scene || typeof scene !== "object") return false;
  const layers = /** @type {{ layers?: unknown[] }} */ (scene).layers;
  if (!Array.isArray(layers)) return false;
  return layers.some(layerIsTakeable);
}

/**
 * Prefer the scene that can actually be taken (has layer sources).
 *
 * @param {object | null | undefined} a
 * @param {object | null | undefined} b
 * @returns {object | null}
 */
function pickRicherLookScene(a, b) {
  if (!a) return b && typeof b === "object" ? b : null;
  if (!b || typeof b !== "object") return a;
  const aOk = sceneHasTakeableLayers(a);
  const bOk = sceneHasTakeableLayers(b);
  if (aOk && !bOk) return a;
  if (bOk && !aOk) return b;
  const countSources = (s) =>
    (Array.isArray(s.layers) ? s.layers : []).filter(layerIsTakeable).length;
  return countSources(b) > countSources(a) ? b : a;
}

/**
 * Deck metadata (name, scope) over saved project layers.
 *
 * @param {object | null | undefined} projectScene
 * @param {object | null | undefined} deckScene
 */
function mergeDeckMetaIntoProjectScene(projectScene, deckScene) {
  if (!projectScene) return deckScene && typeof deckScene === "object" ? deckScene : null;
  if (!deckScene || typeof deckScene !== "object") return projectScene;
  return {
    ...projectScene,
    name: deckScene.name ?? projectScene.name,
    mainScope: deckScene.mainScope ?? projectScene.mainScope,
  };
}

/**
 * Build incomingScene for POST /api/scene/take — aligned with HighAsCG web payload.
 *
 * @param {object} scene
 * @param {{
 *   programChannel?: number,
 *   mainIdx?: number,
 *   fps?: number,
 *   pgmOnly?: boolean,
 * } | null | undefined} [seekOpts]
 * @returns {object}
 */
function buildIncomingScenePayload(scene, seekOpts) {
  if (!scene || typeof scene !== "object") {
    throw new Error("Invalid scene object");
  }
  const layers = Array.isArray(scene.layers) ? scene.layers : [];
  const payload = {
    id: scene.id,
    name: scene.name || "Untitled look",
    ...(scene.mainScope != null && String(scene.mainScope).trim()
      ? { mainScope: String(scene.mainScope) }
      : {}),
    defaultTransition: scene.defaultTransition
      ? { ...scene.defaultTransition }
      : { type: "CUT", duration: 0, tween: "linear" },
    layers: layers.map((l) => {
      const row = {
        layerNumber: l.layerNumber,
        source: l.source
          ? {
              type: l.source.type,
              value: l.source.value,
              ...(l.source.isPlaceholder != null
                ? { isPlaceholder: !!l.source.isPlaceholder }
                : {}),
              ...(l.source.template != null
                ? { template: l.source.template }
                : {}),
              ...(l.source.parameters != null
                ? { parameters: l.source.parameters }
                : {}),
              ...(l.source.lowerThirdConfig != null
                ? { lowerThirdConfig: l.source.lowerThirdConfig }
                : {}),
            }
          : null,
        loop: !!l.loop,
        straightAlpha: !!l.straightAlpha,
        contentFit:
          l.contentFit ||
          (l.fillNativeAspect === false ? "stretch" : "native"),
        aspectLocked: l.aspectLocked !== false,
        fill: l.fill ? { ...l.fill } : undefined,
        opacity: l.opacity ?? 1,
        rotation: l.rotation ?? 0,
        transition: l.transition ? { ...l.transition } : null,
        audioRoute: l.audioRoute || "1+2",
        muted: !!l.muted,
        volume: l.volume != null ? l.volume : 1,
        sourceMode: l.sourceMode || "single",
      };
      if (Array.isArray(l.effects) && l.effects.length > 0) {
        row.effects = JSON.parse(JSON.stringify(l.effects));
      }
      if (Array.isArray(l.pipOverlays) && l.pipOverlays.length > 0) {
        row.pipOverlays = JSON.parse(JSON.stringify(l.pipOverlays));
      }
      if (l.templateData && typeof l.templateData === "object") {
        row.templateData = JSON.parse(JSON.stringify(l.templateData));
      } else if (
        l.source?.type === "template" &&
        l.source?.data &&
        typeof l.source.data === "object"
      ) {
        row.cgData = JSON.parse(JSON.stringify(l.source.data));
      }
      return row;
    }),
  };
  if (scene.globalBorder && typeof scene.globalBorder === "object") {
    payload.globalBorder = JSON.parse(JSON.stringify(scene.globalBorder));
  }
  if (seekOpts && seekOpts.mainIdx != null) {
    const res =
      seekOpts.composeCanvas ||
      (seekOpts.programResolutions &&
        seekOpts.programResolutions[seekOpts.mainIdx]);
    if (res && res.w && res.h) {
      payload.composeCanvas = { w: res.w, h: res.h };
    } else if (res && res.width && res.height) {
      payload.composeCanvas = { w: res.width, h: res.height };
    }
  }
  return payload;
}

/**
 * @param {object} project — body from POST /api/project/load
 * @param {{ name?: string, id?: string }} query — exactly one should match
 * @returns {object | null}
 */
function findLookInProject(project, query) {
  if (!project || typeof project !== "object") return null;
  const scenes = extractProjectScenes(project);
  if (!scenes.length) return null;
  const wantName = (query.name || "").trim();
  const wantId = (query.id || "").trim();
  if (wantId) {
    const byId = scenes.find((s) => String(s.id) === wantId);
    return byId || null;
  }
  if (wantName) {
    const lower = wantName.toLowerCase();
    return (
      scenes.find((s) => (s.name || "").trim().toLowerCase() === lower) ||
      null
    );
  }
  return null;
}

/**
 * Resolve a look from live deck WebSocket snapshots (browser state before Save).
 * @param {Map<string, object> | null | undefined} deckMap
 * @param {string} id
 * @returns {object | null}
 */
function findLookInDeckSnapshots(deckMap, id) {
  if (!deckMap || typeof deckMap.get !== "function") return null;
  const k = String(id || "").trim();
  if (!k) return null;
  const s = deckMap.get(k);
  return s && typeof s === "object" ? s : null;
}

/**
 * Resolve look JSON for Companion take/cue.
 *
 * When the saved project has layer sources, prefer server-side resolution
 * (`sceneId` only) so LOADBG uses authoritative clip paths from disk.
 * Deck WS snapshots can lag or carry placeholder paths that fail LOADBG.
 *
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {string} lookId
 * @returns {Promise<{ mode: 'server' | 'client', sceneId: string, scene: object } | null>}
 */
async function resolveLookSceneForTake(instance, lookId) {
  const raw = String(lookId ?? "").trim();
  if (!raw) return null;

  const deckScene = findLookInDeckSnapshots(instance._deckSceneById, raw);
  let projectScene = null;
  if (instance._projectScenesCache?.length) {
    projectScene = findLookInProject(
      { scenes: instance._projectScenesCache },
      { id: raw },
    );
  }
  if (!sceneHasTakeableLayers(projectScene) && instance.bridge?.api) {
    try {
      const project = await instance.bridge.api.getProject();
      projectScene = findLookInProject(project, { id: raw }) || projectScene;
    } catch (e) {
      instance.log("debug", `resolveLookScene getProject: ${e.message || e}`);
    }
  }

  if (sceneHasTakeableLayers(projectScene)) {
    const scene = mergeDeckMetaIntoProjectScene(projectScene, deckScene);
    return { mode: "server", sceneId: raw, scene };
  }

  let scene = pickRicherLookScene(deckScene, projectScene);
  if (!sceneHasTakeableLayers(scene)) {
    instance.log(
      "warn",
      `Look "${raw}" has no layers with sources — sync deck from HighAsCG UI or save project.`,
    );
    return null;
  }
  if (String(scene.id ?? "").trim() !== raw) {
    instance.log(
      "warn",
      `Look id mismatch for "${raw}": resolved scene id is "${scene.id}" — using resolved scene.`,
    );
  }
  return { mode: "client", sceneId: raw, scene };
}

/**
 * Full look JSON for take/cue — deck snapshots, then project cache, then GET /api/project.
 *
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {string} lookId
 * @returns {Promise<object | null>}
 */
async function resolveLookScene(instance, lookId) {
  const resolved = await resolveLookSceneForTake(instance, lookId);
  return resolved?.scene ?? null;
}

export {
  buildIncomingScenePayload,
  findLookInProject,
  findLookInDeckSnapshots,
  sceneHasTakeableLayers,
  layerIsTakeable,
  pickRicherLookScene,
  resolveLookScene,
  resolveLookSceneForTake,
};
