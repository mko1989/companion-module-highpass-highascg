/**
 * @file look-take-core.js
 * Shared look take / cue execution via the bridge API.
 */

import {
  buildIncomingScenePayload,
  resolveLookSceneForTake,
  sceneHasTakeableLayers,
} from "../scene-payload.js";
import { refreshLookAirFeedbacks } from "../look-feedback-ids.js";
import { resolveLookTargetScreen } from "../look-scope.js";

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {{ lookId: string, screenIndex: number, forceCut?: boolean, target?: 'program' | 'preview' }} opts
 */
export async function executeLookTake(instance, opts) {
  if (!instance.bridge?.api) return;
  const raw = String(opts.lookId ?? "").trim();
  if (!raw) {
    instance.log("warn", "No look id set.");
    return;
  }
  const resolved = await resolveLookSceneForTake(instance, raw);
  if (!resolved) {
    instance.log(
      "warn",
      `No look found for id "${raw}". Open HighAsCG web UI so the deck can sync or save project.`,
    );
    return;
  }
  const scene = resolved.scene;
  const meta = instance._presetLooks?.find((l) => String(l.id) === raw);
  const screenIndex = resolveLookTargetScreen(
    meta,
    scene,
    opts.screenIndex,
  );
  const target = opts.target === "preview" ? "preview" : "program";
  const st = await instance.bridge.api.getState();
  const cm = st?.channelMap || instance._channelMap || {};
  const pgmCh = cm.programChannels?.[screenIndex];
  if (pgmCh == null || Number(pgmCh) <= 0) {
    instance.log(
      "warn",
      `No PGM channel mapped for screen ${screenIndex + 1}.`,
    );
    return;
  }
  const prvCh = cm.previewChannels?.[screenIndex];
  const hasPrv =
    prvCh != null &&
    Number(prvCh) > 0 &&
    Number(prvCh) !== Number(pgmCh);
  if (target === "preview" && !hasPrv) {
    instance.log(
      "warn",
      `Screen ${screenIndex + 1} is PGM-only (no PRV bus). Use Program target or add a PGM/PRV destination in HighAsCG.`,
    );
    return;
  }
  const fps = cm.programResolutions?.[screenIndex]?.fps ?? 50;
  const res = cm.programResolutions?.[screenIndex];
  const forceCut =
    target === "preview" ? true : !!opts.forceCut;

  const seekOpts = {
    programChannel: Number(pgmCh),
    mainIdx: screenIndex,
    fps: Number(fps) || 50,
    programResolutions: cm.programResolutions,
    composeCanvas:
      res && res.w && res.h
        ? { w: res.w, h: res.h }
        : res?.width && res?.height
          ? { w: res.width, h: res.height }
          : undefined,
    pgmOnly: target === "program" && !hasPrv,
  };

  /** @type {Record<string, unknown>} */
  const takeBody = {
    channel: Number(pgmCh),
    sceneId: resolved.sceneId,
    framerate: Number(fps) || 50,
    forceCut,
    useServerLive: true,
    ...(target === "preview" ? { target: "preview" } : {}),
  };

  // Always let HighAsCG resolve saved looks from disk (authoritative clip paths).
  // Sending deck WS snapshots as incomingScene causes Caspar 404 LOADBG FAILED.
  try {
    await instance.bridge.api.sceneTake(takeBody);
  } catch (e) {
    const msg = String(e?.message || e);
    const needsDeckPayload =
      /incomingScene|layer list missing|no layers with sources|scene not found/i.test(
        msg,
      );
    if (!needsDeckPayload || !sceneHasTakeableLayers(scene)) {
      throw e;
    }
    instance.log(
      "debug",
      `Take "${raw}": server project resolve failed — retrying with deck snapshot`,
    );
    await instance.bridge.api.sceneTake({
      ...takeBody,
      incomingScene: buildIncomingScenePayload(scene, seekOpts),
    });
  }

  refreshLookAirFeedbacks(instance);
}

export async function previewLookById(instance, lookId, screenIndex, forceCut) {
  return executeLookTake(instance, {
    lookId,
    screenIndex,
    forceCut,
    target: "preview",
  });
}

export async function takeLookById(instance, lookId, screenIndex, forceCut) {
  return executeLookTake(instance, {
    lookId,
    screenIndex,
    forceCut,
    target: "program",
  });
}
