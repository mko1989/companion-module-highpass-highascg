/**
 * WO-572 (HighAsCG) — audio-only looks: additive per-screen audio that plays without touching a
 * screen's video look, tracked in a SEPARATE live map (scene.liveAudioOnly / instance._sceneLiveAudioOnly)
 * so a video look and an audio-only look can both be live on the same screen at once.
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
