import {
  presetLiteral,
  connectionVariableExpression,
} from "./connection-expressions.js";
import { combineRgb } from "@companion-module/base";
import {
  LABEL_AIR_ID,
  LABEL_BOTTOM_H,
  LABEL_BOTTOM_Y,
  LABEL_IDLE_ID,
  LABEL_ON_AIR_FONTSIZE,
} from "./look-button-style.js";

/**
 * On-air: hide idle label; show bottom label over preview (no background box).
 *
 * @param {string} _lookId
 */
export function labelOnAirOverrides(_lookId) {
  return [
    {
      elementId: LABEL_IDLE_ID,
      elementProperty: "opacity",
      override: presetLiteral(0),
    },
    {
      elementId: LABEL_AIR_ID,
      elementProperty: "opacity",
      override: presetLiteral(100),
    },
    {
      elementId: LABEL_AIR_ID,
      elementProperty: "y",
      override: presetLiteral(LABEL_BOTTOM_Y),
    },
    {
      elementId: LABEL_AIR_ID,
      elementProperty: "height",
      override: presetLiteral(LABEL_BOTTOM_H),
    },
    {
      elementId: LABEL_AIR_ID,
      elementProperty: "fontsize",
      override: presetLiteral(LABEL_ON_AIR_FONTSIZE),
    },
    {
      elementId: LABEL_AIR_ID,
      elementProperty: "fontsizeAllowShrink",
      override: presetLiteral(false),
    },
    {
      elementId: LABEL_AIR_ID,
      elementProperty: "valign",
      override: presetLiteral("center"),
    },
    {
      elementId: LABEL_AIR_ID,
      elementProperty: "color",
      override: presetLiteral(combineRgb(255, 255, 255)),
    },
    {
      elementId: LABEL_AIR_ID,
      elementProperty: "outlineColor",
      override: presetLiteral(combineRgb(0, 0, 0)),
    },
  ];
}

/**
 * PGM or PRV tally — border, on-air label, live compose preview on the matching layer.
 *
 * @param {object} opts
 * @param {import('./instance.js').HighAsCGInstance} opts.instance
 * @param {string} opts.lookId
 * @param {string} opts.borderId
 * @param {string} opts.previewLayerId
 * @param {string} opts.previewVariableId — per-look var, e.g. highascg_look_air_frame_{slug}
 */
export function buildLookTallyStyleOverrides(opts) {
  /** @type {import('@companion-module/base').CompanionPresetFeedbackStyleOverride[]} */
  const overrides = [...labelOnAirOverrides(opts.lookId)];
  overrides.push({
    elementId: opts.previewLayerId,
    elementProperty: "base64Image",
    override: connectionVariableExpression(
      opts.instance,
      opts.previewVariableId,
    ),
  });
  overrides.push({
    elementId: opts.previewLayerId,
    elementProperty: "opacity",
    override: presetLiteral(100),
  });
  overrides.push({
    elementId: opts.borderId,
    elementProperty: "opacity",
    override: presetLiteral(100),
  });
  return overrides;
}

/**
 * Merge style override arrays; later entries win for the same element/property.
 */
export function mergeStyleOverrides(existing, additions) {
  const map = new Map();
  for (const item of existing || []) {
    map.set(`${item.elementId}\0${item.elementProperty}`, item);
  }
  for (const item of additions || []) {
    map.set(`${item.elementId}\0${item.elementProperty}`, item);
  }
  return [...map.values()];
}

export { connectionVariableExpression } from "./connection-expressions.js";
