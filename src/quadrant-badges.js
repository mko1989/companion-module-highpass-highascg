import { combineRgb } from "@companion-module/base";
import { resolveScreenIndexForChannel } from "./compose-preview-channels.js";
import { resolveChannelBusStyle } from "./quadrant-edge-borders.js";

/** @typedef {'tl' | 'tr' | 'bl' | 'br'} QuadrantId */

const BADGE_X = -20;
const BUS_BADGE_X = 20;
const BADGE_Y = 56;
const BADGE_W = 100;
const BADGE_H = 50;
const BADGE_FONTSIZE = 40;

/**
 * Seam-safe corner badges for 2×2 quadrant buttons (WO-72).
 * BL → bus (PGM/PRV); BR → screen (SCR n). TL/TR → none.
 *
 * @param {import('./instance.js').HighAsCGInstance | null | undefined} instance
 * @param {number} channel
 * @param {QuadrantId} quadrant
 * @returns {Array<Record<string, unknown>>}
 */
export function quadrantBadgeElements(instance, channel, quadrant) {
  const badgeBox = {
    y: BADGE_Y,
    width: BADGE_W,
    height: BADGE_H,
    opacity: 100,
    fontsize: BADGE_FONTSIZE,
    fontsizeAllowShrink: false,
    font: "companion-sans",
    color: combineRgb(255, 255, 255),
    valign: "center",
  };

  if (quadrant === "bl") {
    const bus = resolveChannelBusStyle(instance, channel);
    if (!bus.bus) return [];
    return [
      {
        type: "text",
        id: "bus_badge",
        ...badgeBox,
        x: BUS_BADGE_X,
        text: bus.label,
        outlineColor: bus.color,
        halign: "left",
      },
    ];
  }

  if (quadrant === "br") {
    const screenIdx = resolveScreenIndexForChannel(instance, channel);
    return [
      {
        type: "text",
        id: "screen_badge",
        ...badgeBox,
        x: BADGE_X,
        text: `SCR ${screenIdx + 1}`,
        outlineColor: combineRgb(0, 0, 0),
        halign: "right",
      },
    ];
  }

  return [];
}
