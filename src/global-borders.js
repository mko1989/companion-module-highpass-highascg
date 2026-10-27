/**
 * @file global-borders.js
 * Per-screen global border state (HighAsCG `project.scenes.globalBorders[i]`), fed from
 * GET /api/state, the `project_sync` broadcast and each border action's reply. Publishes the
 * `highascg_global_border_<n>_*` variables and re-checks the `global_border_on` feedback.
 */

import { combineRgb } from "@companion-module/base";
import { buildScreenDropdown } from "./actions/ftb-actions.js";

/** HighAsCG keeps four border slots (one per main screen). */
export const GLOBAL_BORDER_SCREENS = 4;

export const GLOBAL_BORDER_TYPES = [
  { id: "border", label: "Border" },
  { id: "glow", label: "Glow" },
  { id: "edge_strip", label: "Edge strip" },
  { id: "shadow", label: "Drop shadow" },
];

/** Colour keys, labelled with the border types that read them. */
export const GLOBAL_BORDER_COLOR_KEYS = [
  { id: "color", label: "Colour (all types)" },
  { id: "glowColor", label: "Glow colour (edge strip)" },
  { id: "color2", label: "Second colour (glow)" },
  { id: "altColor", label: "Alternate colour (edge strip)" },
  { id: "altGlowColor", label: "Alternate glow colour (edge strip)" },
];

/** Numeric / on-off keys from the HighAsCG border inspector, labelled with their types + range. */
export const GLOBAL_BORDER_PARAM_KEYS = [
  { id: "width", label: "Width (border, glow) 0–50" },
  { id: "radius", label: "Corner radius (all) 0–50" },
  { id: "thickness", label: "Thickness (edge strip) 1–20" },
  { id: "speed", label: "Speed px/s (edge strip) 10–3000" },
  { id: "length", label: "Strip length (edge strip) 10–2000" },
  { id: "count", label: "Strip count (edge strip) 1–12" },
  { id: "glowWidth", label: "Glow width (edge strip) 1–50" },
  { id: "intensity", label: "Intensity (glow) 1–50" },
  { id: "pulseSpeed", label: "Pulse speed (glow) 0–8" },
  { id: "minOpacity", label: "Pulse min opacity (glow) 0–1" },
  { id: "colorCycleSec", label: "Colour cycle sec (glow) 0.2–20" },
  { id: "blur", label: "Blur (shadow) 0–100" },
  { id: "spread", label: "Spread (shadow) −20–20" },
  { id: "offsetX", label: "Offset X (shadow) −50–50" },
  { id: "offsetY", label: "Offset Y (shadow) −50–50" },
  { id: "pulse", label: "Pulse on/off (glow) true|false" },
  { id: "color2Enabled", label: "Second colour on/off (glow) true|false" },
  { id: "glow", label: "Glow on/off (edge strip) true|false" },
  { id: "altColors", label: "Alternating colours (edge strip) true|false" },
  { id: "roundedTips", label: "Rounded tips (edge strip) true|false" },
];

/** @param {number} i 0-based screen */
export const globalBorderVariableId = (i, field) =>
  `highascg_global_border_${i + 1}_${field}`;

/** @returns {{ variableId: string, name: string }[]} */
export function globalBorderVariableDefinitions() {
  const defs = [];
  for (let i = 0; i < GLOBAL_BORDER_SCREENS; i++) {
    defs.push(
      {
        variableId: globalBorderVariableId(i, "state"),
        name: `Screen ${i + 1}: global border ON / OFF (empty = not set up)`,
      },
      {
        variableId: globalBorderVariableId(i, "type"),
        name: `Screen ${i + 1}: global border type`,
      },
      {
        variableId: globalBorderVariableId(i, "color"),
        name: `Screen ${i + 1}: global border colour`,
      },
      {
        variableId: globalBorderVariableId(i, "opacity"),
        name: `Screen ${i + 1}: global border opacity %`,
      },
    );
  }
  return defs;
}

/** @returns {Record<string, string>} */
function variableValues(borders) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < GLOBAL_BORDER_SCREENS; i++) {
    const b = borders[i];
    const p = b?.params || {};
    const opacity = p.opacity != null ? Number(p.opacity) : b ? 1 : NaN;
    out[globalBorderVariableId(i, "state")] = b
      ? b.enabled
        ? "ON"
        : "OFF"
      : "";
    out[globalBorderVariableId(i, "type")] = b
      ? String(b.type || "border")
      : "";
    out[globalBorderVariableId(i, "color")] =
      b && p.color != null ? String(p.color) : "";
    out[globalBorderVariableId(i, "opacity")] = Number.isFinite(opacity)
      ? String(Math.round(opacity * 100))
      : "";
  }
  return out;
}

/**
 * Store the border slots and publish variables + feedback when anything changed.
 * @param {import('./instance.js').HighAsCGInstance} instance
 * @param {unknown} arr — `globalBorders` array (null entries = not set up)
 */
export function ingestGlobalBorders(instance, arr) {
  if (!Array.isArray(arr)) return;
  const next = Array.from({ length: GLOBAL_BORDER_SCREENS }, (_, i) =>
    arr[i] && typeof arr[i] === "object" ? arr[i] : null,
  );
  const sig = JSON.stringify(variableValues(next));
  instance._globalBorders = next;
  if (sig === instance._globalBordersSig) return;
  instance._globalBordersSig = sig;
  instance.setVariableValues(variableValues(next));
  instance.checkFeedbacks("global_border_on");
}

/** One slot changed (an action's reply) — apply it without waiting for project_sync. */
export function ingestGlobalBorderSlot(instance, screenIdx, slot) {
  if (!slot || typeof slot !== "object") return;
  const arr = [...(instance._globalBorders || [])];
  arr[screenIdx] = slot;
  ingestGlobalBorders(instance, arr);
}

/** @param {import('./instance.js').HighAsCGInstance} instance */
export function getGlobalBorderFeedbacks(instance) {
  return {
    global_border_on: {
      type: "boolean",
      name: "Global border: is on",
      description: "True while the screen's global border is switched on.",
      defaultStyle: {
        bgcolor: combineRgb(200, 0, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "dropdown",
          id: "screen",
          label: "Screen",
          ...buildScreenDropdown(instance),
        },
      ],
      callback: (feedback) => {
        const i = parseInt(feedback.options?.screen, 10) || 0;
        return !!instance._globalBorders?.[i]?.enabled;
      },
    },
  };
}
