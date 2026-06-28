import { combineRgb } from "@companion-module/base";

/** Transparent box fill (Companion ARGB: combineRgb(0,0,0,0) → 4278190080). */
export const TRANSPARENT_FILL = combineRgb(0, 0, 0, 0);

/** Border stroke width in pixels (Companion box borderWidth). */
export const BORDER_WIDTH_PX = 4;

/** Idle label — centered, larger than on-air strip. */
export const LABEL_IDLE_FONTSIZE = 24;

/** On-air overlay label id — must be the topmost layer (drawn over preview + borders). */
export const LABEL_AIR_ID = "label_air";

/** Idle centered label id — hidden while on PGM/PRV. */
export const LABEL_IDLE_ID = "label";

/** On-air label bar — bottom third, forced size via feedback overrides. */
export const LABEL_AIR_BG_ID = "label_air_bg";
export const LABEL_ON_AIR_FONTSIZE = 36;
export const LABEL_BOTTOM_Y = 52;
export const LABEL_BOTTOM_H = 48;

/**
 * @param {string} label
 * @returns {string}
 */
export function singleLineLabel(label) {
  return String(label ?? "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}
