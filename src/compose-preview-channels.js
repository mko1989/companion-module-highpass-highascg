/**
 * Compose preview channel list and Companion-side traffic gates (WO-72).
 */

/**
 * @param {Record<string, unknown>} [config]
 * @returns {boolean}
 */
export function isComposePreviewButtonsEnabled(config) {
  return config?.compose_preview_buttons_enabled !== false;
}

/**
 * PGM + PRV channels from HighAsCG channelMap (deduped, sorted). No placeholder ch4–8.
 *
 * @param {import('./instance.js').HighAsCGInstance | null | undefined} instance
 * @returns {number[]}
 */
export function resolveComposePreviewChannels(instance) {
  const map = instance?._channelMap;
  /** @type {Set<number>} */
  const set = new Set();

  const addList = (list) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) set.add(Math.trunc(n));
    }
  };

  addList(map?.programChannels);
  addList(map?.previewChannels);

  if (set.size === 0) {
    return [1];
  }

  return [...set].sort((a, b) => a - b);
}

/**
 * @param {import('./instance.js').HighAsCGInstance | null | undefined} instance
 * @param {number} channel
 * @returns {number}
 */
export function resolveScreenIndexForChannel(instance, channel) {
  const ch = Number(channel);
  if (!Number.isFinite(ch) || ch <= 0) return 0;

  const pgm = Array.isArray(instance?._channelMap?.programChannels)
    ? instance._channelMap.programChannels
    : [];
  const prv = Array.isArray(instance?._channelMap?.previewChannels)
    ? instance._channelMap.previewChannels
    : [];

  const len = Math.max(pgm.length, prv.length, 1);
  for (let i = 0; i < len; i += 1) {
    if (Number(pgm[i]) === ch || Number(prv[i]) === ch) return i;
  }
  return 0;
}
