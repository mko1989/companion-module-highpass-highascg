import { combineRgb } from "@companion-module/base";
import { resolveScreenIndexForChannel } from "./compose-preview-channels.js";
import { resolveChannelBusStyle } from "./quadrant-edge-borders.js";

/** @typedef {'tl' | 'tr' | 'bl' | 'br'} QuadrantId */

/* Companion 5's layered-element schema clamps x/y/width/height to 0..100 (percent of the
 * button); any out-of-range value rejects the WHOLE preset ("layered preset definitions
 * contain invalid elements" — the old BADGE_X = -20 killed every ·Bottom-right· quad preset).
 * The right-hanging screen badge is expressed as x:0 + width:SCREEN_BADGE_W with halign
 * right — same visible right edge at 80%, all values in range. */
const BUS_BADGE_X = 20;
const BADGE_Y = 56;
const BADGE_W = 100;
const SCREEN_BADGE_W = 80;
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
        x: 0,
        width: SCREEN_BADGE_W,
        text: `SCR ${screenIdx + 1}`,
        outlineColor: combineRgb(0, 0, 0),
        halign: "right",
      },
    ];
  }

  return [];
}
