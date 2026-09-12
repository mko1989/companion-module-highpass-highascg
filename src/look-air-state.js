/**
 * Feedbacks that bind compose preview images on layered buttons.
 */
export const LOOK_COMPOSE_PREVIEW_FEEDBACKS = [
  "look_on_pgm",
  "look_on_prv_for_screen",
  "look_on_prv",
  "look_slot_on_pgm",
  "look_slot_on_prv",
  "look_compose_preview_image",
];

/**
 * Resolve whether a look is on PGM or PRV for a screen and which compose-preview channel to show.
 *
 * @param {import('./instance.js').HighAsCGInstance} instance
 * @param {string} lookId
 * @param {number} screenIndex
 * @returns {{
 *   onPgm: boolean,
 *   onPrv: boolean,
 *   bus: 'pgm' | 'prv' | null,
 *   previewChannel: number | null,
 *   previewVariableId: string | null,
 * }}
 */
export function resolveLookAirState(instance, lookId, screenIndex) {
  const id = String(lookId ?? "").trim();
  const screenIdx = Math.max(0, parseInt(String(screenIndex), 10) || 0);
  const empty = {
    onPgm: false,
    onPrv: false,
    bus: null,
    previewChannel: null,
    previewVariableId: null,
  };
  if (!id) return empty;

  const pgmCh = instance._channelMap?.programChannels?.[screenIdx];
  const prvChRaw = instance._channelMap?.previewChannels?.[screenIdx];
  const prvNum = prvChRaw != null ? Number(prvChRaw) : NaN;
  const hasPrv =
    Number.isFinite(prvNum) && prvNum > 0 && prvNum !== Number(pgmCh);

  let onPgm = false;
  if (pgmCh != null) {
    const entry = instance._sceneLive?.[String(pgmCh)];
    const sid = entry?.sceneId != null ? String(entry.sceneId).trim() : "";
    onPgm = sid === id;
  }

  let onPrv = false;
  if (hasPrv && !onPgm) {
    const entry = instance._sceneLive?.[String(prvNum)];
    const sid = entry?.sceneId != null ? String(entry.sceneId).trim() : "";
    onPrv = sid === id;
  }

  if (onPgm && pgmCh != null) {
    const ch = Number(pgmCh);
    return {
      onPgm: true,
      onPrv: false,
      bus: "pgm",
      previewChannel: ch,
      previewVariableId: `highascg_compose_preview_ch${ch}_image`,
    };
  }

  if (onPrv) {
    return {
      onPgm: false,
      onPrv: true,
      bus: "prv",
      previewChannel: prvNum,
      previewVariableId: `highascg_compose_preview_ch${prvNum}_image`,
    };
  }

  return empty;
}

/**
 * WO-572 (HighAsCG) — audio-only looks: additive per-screen audio that plays without touching a
 * screen's video look, tracked in a SEPARATE live map (scene.liveAudioOnly / instance._sceneLiveAudioOnly)
 * so a video look and an audio-only look can both be live on the same screen at once. No compose-preview
 * image applies here (audio has no visual frame) — this deliberately mirrors only the onPgm/onPrv half
 * of resolveLookAirState above, not the preview-image half.
 *
 * @param {import('./instance.js').HighAsCGInstance} instance
 * @param {string} lookId
 * @param {number} screenIndex
 * @returns {{ onPgm: boolean, onPrv: boolean }}
 */
export function resolveAudioOnlyLookAirState(instance, lookId, screenIndex) {
  const id = String(lookId ?? "").trim();
  const screenIdx = Math.max(0, parseInt(String(screenIndex), 10) || 0);
  const empty = { onPgm: false, onPrv: false };
  if (!id) return empty;

  const pgmCh = instance._channelMap?.programChannels?.[screenIdx];
  const prvChRaw = instance._channelMap?.previewChannels?.[screenIdx];
  const prvNum = prvChRaw != null ? Number(prvChRaw) : NaN;
  const hasPrv =
    Number.isFinite(prvNum) && prvNum > 0 && prvNum !== Number(pgmCh);

  let onPgm = false;
  if (pgmCh != null) {
    const entry = instance._sceneLiveAudioOnly?.[String(pgmCh)];
    const sid = entry?.sceneId != null ? String(entry.sceneId).trim() : "";
    onPgm = sid === id;
  }

  let onPrv = false;
  if (hasPrv && !onPgm) {
    const entry = instance._sceneLiveAudioOnly?.[String(prvNum)];
    const sid = entry?.sceneId != null ? String(entry.sceneId).trim() : "";
    onPrv = sid === id;
  }

  return { onPgm, onPrv };
}

/**
 * @param {string} dataUri
 * @returns {string}
 */
export function dataUriToRawBase64(dataUri) {
  const s = String(dataUri ?? "");
  const comma = s.indexOf(",");
  return comma >= 0 ? s.slice(comma + 1) : s;
}
