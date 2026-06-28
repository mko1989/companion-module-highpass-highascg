/** @typedef {'tl' | 'tr' | 'bl' | 'br'} QuadrantId */

import {
  connectionVariableExpression,
  presetLiteral,
  presetExpression,
} from "../connection-expressions.js";
export {
  MODULE_ID,
  connectionVariableExpression,
  presetLiteral,
  presetExpression,
} from "../connection-expressions.js";
import {
  isComposePreviewButtonsEnabled,
  resolveComposePreviewChannels,
} from "../compose-preview-channels.js";
import {
  quadrantOuterEdgeBars,
  resolveChannelBusStyle,
} from "../quadrant-edge-borders.js";
import { quadrantBadgeElements } from "../quadrant-badges.js";
import {
  composePreviewImageVariableId,
  composePreviewQuadrantVariableId,
} from "../variables.js";

export { resolveComposePreviewChannels } from "../compose-preview-channels.js";

export const QUADRANTS = /** @type {const} */ ([
  { id: "tl", label: "Top-left" },
  { id: "tr", label: "Top-right" },
  { id: "bl", label: "Bottom-left" },
  { id: "br", label: "Bottom-right" },
]);

export function previewOnlySteps() {
  return [{ down: [], up: [] }];
}

/**
 * @param {import('../instance.js').HighAsCGInstance | undefined} instance
 * @param {string} variableId
 * @param {{ fillMode?: string }} [opts]
 */
function previewImageElement(instance, variableId, opts = {}) {
  return {
    type: "image",
    id: "preview",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    opacity: 100,
    base64Image: connectionVariableExpression(instance, variableId),
    halign: "center",
    valign: "center",
    fillMode: opts.fillMode ?? "fit",
  };
}

/**
 * @param {import('../instance.js').HighAsCGInstance | undefined} instance
 * @param {string} name
 * @param {string} variableId
 * @param {Array<Record<string, unknown>>} [extraElements]
 */
function layeredPreviewPreset(instance, name, variableId, extraElements = []) {
  return {
    type: "layered",
    name,
    canvas: {
      decoration: "none",
      showStatusIcons: "none",
    },
    elements: [previewImageElement(instance, variableId), ...extraElements],
    feedbacks: [],
    steps: previewOnlySteps(),
  };
}

/**
 * @param {Record<string, object>} presets
 * @param {Array<{ id: string, definitions: string[] }>} structure
 * @param {import('../instance.js').HighAsCGInstance} [instance]
 */
export function addComposePreviewPresets(presets, structure, instance) {
  if (!isComposePreviewButtonsEnabled(instance?.config)) {
    return;
  }

  const full = structure.find((s) => s.id === "compose_preview");
  const quads = structure.find((s) => s.id === "compose_preview_quadrants");
  if (!full || !quads) {
    throw new Error("compose preview preset sections missing");
  }

  full.definitions.length = 0;
  quads.definitions.length = 0;

  const channels = resolveComposePreviewChannels(instance);

  for (const ch of channels) {
    const varId = composePreviewImageVariableId(ch);
    const key = `preview_ch${ch}`;
    presets[key] = layeredPreviewPreset(instance, `Preview channel ${ch}`, varId);
    full.definitions.push(key);
  }

  for (const ch of channels) {
    for (const quad of QUADRANTS) {
      const varId = composePreviewQuadrantVariableId(ch, quad.id);
      const key = `preview_ch${ch}_quad_${quad.id}`;
      const bus = resolveChannelBusStyle(instance, ch);
      const edgeBars = quadrantOuterEdgeBars(
        quad.id,
        bus.color,
        `${bus.bus || "bus"}_${quad.id}`,
      );
      const badges = quadrantBadgeElements(instance, ch, quad.id);
      presets[key] = layeredPreviewPreset(
        instance,
        `Preview ch${ch} · ${quad.label} · ${bus.label}`,
        varId,
        [...edgeBars, ...badges],
      );
      quads.definitions.push(key);
    }
  }
}
