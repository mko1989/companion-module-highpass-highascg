/**
 * PRV → PGM take helpers — mirrors HighAsCG web `takeSceneToProgram` / `globalTakeFromPreview`.
 */

import {
  buildIncomingScenePayload,
  resolveLookSceneForTake,
  sceneHasTakeableLayers,
} from "../scene-payload.js";
import { refreshLookAirFeedbacks } from "../look-feedback-ids.js";

/**
 * @param {unknown} entry — scene.live channel entry
 */
function sceneLiveEntryHasContent(entry) {
  const scene = entry?.scene;
  if (!scene || !Array.isArray(scene.layers)) return false;
  return scene.layers.some(
    (l) =>
      l &&
      l.source &&
      ((l.source.value != null && String(l.source.value).trim() !== "") ||
        l.source.type != null),
  );
}

/**
 * @param {object} cm — channelMap from /api/state
 * @param {number} screenIndex
 */
function screenChannelInfo(cm, screenIndex) {
  const idx = Math.max(0, parseInt(screenIndex, 10) || 0);
  const pgmCh = cm.programChannels?.[idx];
  const prvCh = cm.previewChannels?.[idx];
  const hasPrv =
    prvCh != null &&
    Number(prvCh) > 0 &&
    Number(pgmCh) > 0 &&
    Number(prvCh) !== Number(pgmCh);
  const res = cm.programResolutions?.[idx];
  const fps = res?.fps ?? 50;
  return { idx, pgmCh, prvCh, hasPrv, fps, res };
}

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {number} screenIndex — 0-based
 * @param {boolean} forceCut
 * @returns {Promise<boolean>} true when a take was executed
 */
async function takeFromPreviewForScreen(instance, screenIndex, forceCut) {
  if (!instance.bridge?.api) return false;
  const st = await instance.bridge.api.getState();
  const cm = st?.channelMap || instance._channelMap || {};
  const { idx, pgmCh, prvCh, hasPrv, fps, res } = screenChannelInfo(
    cm,
    screenIndex,
  );
  if (pgmCh == null || Number(pgmCh) <= 0) {
    instance.log("warn", `Take from preview: no PGM channel for screen ${idx + 1}.`);
    return false;
  }
  if (!hasPrv) {
    instance.log(
      "debug",
      `Take from preview: screen ${idx + 1} has no separate PRV bus — skipped.`,
    );
    return false;
  }
  const live = st?.scene?.live || instance._sceneLive || {};
  const prvEntry = live[String(prvCh)];
  if (!sceneLiveEntryHasContent(prvEntry)) {
    instance.log(
      "debug",
      `Take from preview: nothing staged on screen ${idx + 1} PRV (ch ${prvCh}).`,
    );
    return false;
  }
  const sceneId = String(
    prvEntry.sceneId ?? prvEntry.scene?.id ?? "",
  ).trim();
  if (!sceneId) {
    instance.log(
      "warn",
      `Take from preview: PRV ch ${prvCh} has no scene id in scene.live.`,
    );
    return false;
  }
  const resolved = await resolveLookSceneForTake(instance, sceneId);
  const scene = resolved?.scene ?? prvEntry.scene ?? null;
  if (!scene) {
    instance.log(
      "warn",
      `Take from preview: could not resolve look "${sceneId}" from deck/project.`,
    );
    return false;
  }
  const seekOpts = {
    programChannel: Number(pgmCh),
    mainIdx: idx,
    fps: Number(fps) || 50,
    programResolutions: cm.programResolutions,
    composeCanvas:
      res && res.w && res.h
        ? { w: res.w, h: res.h }
        : res?.width && res?.height
          ? { w: res.width, h: res.height }
          : undefined,
    pgmOnly: false,
  };
  /** @type {Record<string, unknown>} */
  const takeBody = {
    channel: Number(pgmCh),
    sceneId,
    framerate: Number(fps) || 50,
    forceCut: !!forceCut,
    useServerLive: true,
  };
  try {
    await instance.bridge.api.sceneTake(takeBody);
  } catch (e) {
    const msg = String(e?.message || e);
    const needsDeckPayload =
      /incomingScene|layer list missing|no layers with sources|scene not found/i.test(
        msg,
      );
    if (!needsDeckPayload || !sceneHasTakeableLayers(scene)) throw e;
    await instance.bridge.api.sceneTake({
      ...takeBody,
      incomingScene: buildIncomingScenePayload(scene, seekOpts),
    });
  }
  refreshLookAirFeedbacks(instance);
  instance.log(
    "info",
    `Take from preview: screen ${idx + 1} "${scene.name || sceneId}" PRV ch${prvCh} → PGM ch${pgmCh}${forceCut ? " (cut)" : ""}.`,
  );
  return true;
}

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {boolean} forceCut
 * @param {number[] | null | undefined} [screenIndices] — omit = all screens with PRV content
 */
async function takeFromPreviewScreens(instance, forceCut, screenIndices) {
  if (!instance.bridge?.api) {
    instance.log("warn", "Enable HighAsCG bridge and configure host/port.");
    return;
  }
  const st = await instance.bridge.api.getState();
  const cm = st?.channelMap || instance._channelMap || {};
  const screenCount = Math.max(
    1,
    Number(cm.screenCount) || cm.programChannels?.length || 1,
  );
  const indices =
    Array.isArray(screenIndices) && screenIndices.length > 0
      ? screenIndices
          .map((i) => Math.max(0, parseInt(i, 10) || 0))
          .filter((i) => i >= 0 && i < screenCount)
      : Array.from({ length: screenCount }, (_, i) => i);

  let taken = 0;
  for (const i of indices) {
    try {
      if (await takeFromPreviewForScreen(instance, i, forceCut)) taken += 1;
    } catch (e) {
      instance.log(
        "error",
        `Take from preview screen ${i + 1}: ${e.message || e}`,
      );
    }
  }
  if (taken === 0) {
    instance.log(
      "warn",
      "Take from preview: no screens had a look staged on PRV (cue looks to preview first).",
    );
  } else {
    refreshLookAirFeedbacks(instance);
    instance.log(
      "info",
      `Take from preview: ${taken} screen(s)${forceCut ? " (cut)" : ""}.`,
    );
  }
}

export {
  sceneLiveEntryHasContent,
  takeFromPreviewForScreen,
  takeFromPreviewScreens,
};
