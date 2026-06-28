import { combineRgb } from "@companion-module/base";
import { filterLooksForScreen } from "../look-scope.js";
import { buildLookTallyStyleOverrides } from "../look-air-overrides.js";
import { lookLabelVariableId } from "../look-vars.js";
import { composePreviewImageVariableId } from "../variables.js";
import {
  connectionVariableExpression,
  connectionLabel,
  presetExpression,
  presetLiteral,
} from "../connection-expressions.js";
import {
  BORDER_WIDTH_PX,
  LABEL_AIR_ID,
  LABEL_IDLE_FONTSIZE,
  LABEL_ON_AIR_FONTSIZE,
  TRANSPARENT_FILL,
} from "../look-button-style.js";

/** Shared by action + feedbacks — change once on the button, everything stays in sync. */
const LOCAL_LOOK_ID = presetExpression("$(local:look_id)");
const LOCAL_SCREEN_INDEX = presetExpression("$(local:screen_index)");

/**
 * @param {number} channel
 * @param {string} id
 */
function channelPreviewLayer(_channel, id) {
  return {
    type: "image",
    id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    opacity: 0,
    // Bind image only when PGM/PRV feedback is active — avoids decoding on every
    // channel preview update for all idle look buttons (Stream Deck USB upload).
    base64Image: presetLiteral(null),
    halign: "center",
    valign: "center",
    fillMode: "fit",
  };
}

/**
 * Hollow border frame using a box (opacity toggled by feedback — more reliable than group/line).
 *
 * @param {string} id
 * @param {number} borderColor
 */
function borderBox(id, borderColor) {
  return {
    type: "box",
    id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    opacity: 0,
    color: TRANSPARENT_FILL,
    borderWidth: BORDER_WIDTH_PX,
    borderColor,
    borderPosition: "inside",
  };
}

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @returns {Array<{ screenIndex: number, pgmCh: number, prvCh: number | null, label: string, sectionId: string }>}
 */
export function getLookPreviewScreenLayouts(instance) {
  const map = instance._channelMap;
  const programChannels = Array.isArray(map?.programChannels)
    ? map.programChannels
    : [];
  const previewChannels = Array.isArray(map?.previewChannels)
    ? map.previewChannels
    : [];
  const screenCount = Math.max(
    1,
    Number(map?.screenCount) || programChannels.length || 1,
  );

  /** @type {ReturnType<typeof getLookPreviewScreenLayouts>} */
  const layouts = [];
  for (let i = 0; i < screenCount; i += 1) {
    const pgmCh = Number(programChannels[i]) || i + 1;
    const rawPrv = previewChannels[i];
    const prvNum = rawPrv != null ? Number(rawPrv) : NaN;
    const hasPrv =
      Number.isFinite(prvNum) && prvNum > 0 && prvNum !== pgmCh;
    layouts.push({
      screenIndex: i,
      pgmCh,
      prvCh: hasPrv ? prvNum : null,
      label: `Screen ${i + 1} · PGM ${pgmCh}${hasPrv ? ` / PRV ${prvNum}` : " · PGM-only"}`,
      sectionId: `look_preview_linked_s${i + 1}`,
    });
  }
  return layouts;
}

/**
 * Layered look button: cue to preview on press (or PGM take on PGM-only screens).
 *
 * @param {object} look
 * @param {ReturnType<typeof getLookPreviewScreenLayouts>[number]} layout
 */
function buildLookPreviewLinkedPreset(look, layout, instance) {
  const display = String(look.name || "Look").slice(0, 36);
  const hasPrv = layout.prvCh != null;
  const labelVar = lookLabelVariableId(look.id);
  const labelExpr = connectionVariableExpression(instance, labelVar);

  const elements = [
    channelPreviewLayer(layout.pgmCh, "preview_pgm"),
    ...(hasPrv && layout.prvCh != null
      ? [channelPreviewLayer(layout.prvCh, "preview_prv")]
      : []),
    borderBox("pgm_border", combineRgb(220, 0, 0)),
    ...(hasPrv ? [borderBox("prv_border", combineRgb(0, 180, 0))] : []),
    {
      type: "text",
      id: "label",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      opacity: 100,
      text: labelExpr,
      fontsize: LABEL_IDLE_FONTSIZE,
      fontsizeAllowShrink: true,
      font: "companion-sans",
      color: combineRgb(255, 255, 255),
      outlineColor: combineRgb(0, 0, 0),
      halign: "center",
      valign: "center",
    },
    {
      type: "text",
      id: LABEL_AIR_ID,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      opacity: 0,
      text: labelExpr,
      fontsize: LABEL_ON_AIR_FONTSIZE,
      fontsizeAllowShrink: false,
      font: "companion-sans",
      color: combineRgb(255, 255, 255),
      outlineColor: combineRgb(0, 0, 0),
      halign: "center",
      valign: "center",
    },
  ];

  const feedbackOptions = {
    look_id: LOCAL_LOOK_ID,
    screen_index: presetLiteral(layout.screenIndex),
  };

  /** @type {import('@companion-module/base').CompanionPresetLayeredFeedback[]} */
  const feedbacks = [
    {
      feedbackId: "look_on_pgm",
      options: feedbackOptions,
      styleOverrides: buildLookTallyStyleOverrides({
        instance,
        lookId: look.id,
        borderId: "pgm_border",
        previewLayerId: "preview_pgm",
        previewVariableId: composePreviewImageVariableId(layout.pgmCh),
      }),
    },
  ];

  if (hasPrv) {
    feedbacks.push({
      feedbackId: "look_on_prv_for_screen",
      options: feedbackOptions,
      styleOverrides: buildLookTallyStyleOverrides({
        instance,
        lookId: look.id,
        borderId: "prv_border",
        previewLayerId: "preview_prv",
        previewVariableId: composePreviewImageVariableId(layout.prvCh),
      }),
    });
  }

  return {
    type: "layered",
    name: `${display} · ${layout.label}${hasPrv ? "" : " (PGM)"}`,
    canvas: {
      decoration: "none",
      showStatusIcons: "none",
    },
    localVariables: [
      {
        variableName: "look_id",
        variableType: "simple",
        startupValue: look.id,
        headline: "Look id (take action + PGM/PRV feedbacks)",
      },
      {
        variableName: "screen_index",
        variableType: "simple",
        startupValue: layout.screenIndex,
        headline: "Screen index (routing for take + feedbacks)",
      },
    ],
    elements,
    feedbacks,
    steps: [
      {
        down: [
          {
            actionId: "look_take",
            options: {
              look_id: LOCAL_LOOK_ID,
              screen_index: LOCAL_SCREEN_INDEX,
              target: hasPrv ? "preview" : "program",
              force_cut: false,
            },
          },
        ],
        up: [],
      },
    ],
  };
}

/**
 * @param {Record<string, object>} presets
 * @param {Array<{ id: string, name: string, definitions: string[] }>} structure
 * @param {import('../instance.js').HighAsCGInstance} instance
 */
export function addLookPreviewLinkedPresets(presets, structure, instance) {
  const allLooks = Array.isArray(instance._presetLooks) ? instance._presetLooks : [];
  const layouts = getLookPreviewScreenLayouts(instance);

  for (let i = structure.length - 1; i >= 0; i -= 1) {
    if (String(structure[i].id).startsWith("look_preview_linked_")) {
      structure.splice(i, 1);
    }
  }

  for (const layout of layouts) {
    const looks = filterLooksForScreen(allLooks, layout.screenIndex);
    let section = {
      id: layout.sectionId,
      name: `HighAsCG · Looks + preview · ${layout.label}`,
      definitions: [],
    };
    structure.push(section);

    for (const look of looks) {
      const base = String(look.id)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 64);
      const key = `look_pv_${layout.screenIndex}_${base}`;
      presets[key] = buildLookPreviewLinkedPreset(look, layout, instance);
      section.definitions.push(key);
    }
  }
}
