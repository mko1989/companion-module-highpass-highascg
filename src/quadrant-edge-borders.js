import { combineRgb } from "@companion-module/base";

/** @typedef {'tl' | 'tr' | 'bl' | 'br'} QuadrantId */

/** Edge bar thickness as % of button (Companion layered coords). */
export const EDGE_BAR_PCT = 4;

export const PGM_BORDER_COLOR = combineRgb(220, 0, 0);
export const PRV_BORDER_COLOR = combineRgb(0, 180, 0);
export const NEUTRAL_BORDER_COLOR = combineRgb(120, 120, 120);

/**
 * @param {import('./instance.js').HighAsCGInstance | null | undefined} instance
 * @param {number} channel
 * @returns {{ bus: 'pgm' | 'prv' | null, color: number, label: string }}
 */
export function resolveChannelBusStyle(instance, channel) {
  const ch = Number(channel);
  if (!Number.isFinite(ch) || ch <= 0) {
    return { bus: null, color: NEUTRAL_BORDER_COLOR, label: "neutral" };
  }

  const pgm = Array.isArray(instance?._channelMap?.programChannels)
    ? instance._channelMap.programChannels
    : [];
  const prv = Array.isArray(instance?._channelMap?.previewChannels)
    ? instance._channelMap.previewChannels
    : [];

  for (let i = 0; i < pgm.length; i += 1) {
    if (Number(pgm[i]) === ch) {
      return { bus: "pgm", color: PGM_BORDER_COLOR, label: "PGM" };
    }
  }

  for (let i = 0; i < prv.length; i += 1) {
    const p = Number(prv[i]);
    const g = Number(pgm[i]);
    if (p === ch && Number.isFinite(p) && p > 0 && p !== g) {
      return { bus: "prv", color: PRV_BORDER_COLOR, label: "PRV" };
    }
  }

  return { bus: null, color: NEUTRAL_BORDER_COLOR, label: "other" };
}

/**
 * Solid bars on outer edges only — avoids a full-frame box border in the middle of a 2×2 grid.
 *
 * @param {QuadrantId} quadrant
 * @param {number} color
 * @param {string} [idPrefix]
 */
export function quadrantOuterEdgeBars(quadrant, color, idPrefix = "edge") {
  const t = EDGE_BAR_PCT;
  const inner = 100 - t;
  /** @type {Array<Record<string, unknown>>} */
  const bars = [];

  const bar = (id, x, y, width, height) => ({
    type: "box",
    id: `${idPrefix}_${id}`,
    x,
    y,
    width,
    height,
    opacity: 100,
    color,
    borderWidth: 0,
  });

  if (quadrant === "tl" || quadrant === "tr") {
    bars.push(bar("top", 0, 0, 100, t));
  }
  if (quadrant === "bl" || quadrant === "br") {
    bars.push(bar("bottom", 0, inner, 100, t));
  }
  if (quadrant === "tl" || quadrant === "bl") {
    bars.push(bar("left", 0, 0, t, 100));
  }
  if (quadrant === "tr" || quadrant === "br") {
    bars.push(bar("right", inner, 0, t, 100));
  }

  return bars;
}
