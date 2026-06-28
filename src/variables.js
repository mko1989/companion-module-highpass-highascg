import { lookLabelVariableId } from "./look-vars.js";
import { lookAirFrameVariableId } from "./look-air-frame.js";
import {
  isComposePreviewButtonsEnabled,
  resolveComposePreviewChannels,
} from "./compose-preview-channels.js";

const CONNECTION_VARIABLE_DEFINITIONS = [
  {
    variableId: "highascg_connection_target",
    name: "Connection target (main or backup)",
  },
  { variableId: "highascg_active_host", name: "Active box host IP" },
  { variableId: "highascg_main_host", name: "Main box host IP" },
  { variableId: "highascg_backup_host", name: "Backup box host IP" },
  {
    variableId: "highascg_accepts_control",
    name: "Active box accepts Companion control (true/false)",
  },
  {
    variableId: "highascg_control_plane_reason",
    name: "Control plane reason (leader_air, follower_standby, …)",
  },
];

const TIMELINE_VARIABLE_DEFINITIONS = [
  { variableId: "highascg_timeline_id", name: "HighAsCG: Active timeline id" },
  { variableId: "highascg_timeline_name", name: "HighAsCG: Active timeline name" },
  { variableId: "highascg_timeline_playing", name: "HighAsCG: Timeline playing (true/false)" },
  { variableId: "highascg_timeline_loop", name: "HighAsCG: Timeline loop (true/false)" },
  { variableId: "highascg_timeline_position", name: "HighAsCG: Timeline position (hh:mm:ss)" },
  { variableId: "highascg_timeline_duration", name: "HighAsCG: Timeline duration (hh:mm:ss)" },
  { variableId: "highascg_timeline_remaining", name: "HighAsCG: Timeline remaining (hh:mm:ss)" },
  { variableId: "highascg_timeline_position_ms", name: "HighAsCG: Timeline position (ms, raw)" },
  { variableId: "highascg_timeline_duration_ms", name: "HighAsCG: Timeline duration (ms, raw)" },
  { variableId: "highascg_timeline_remaining_ms", name: "HighAsCG: Timeline remaining (ms, raw)" },
];

/** @returns {string} Companion variable id for full-frame compose preview on a channel. */
export function composePreviewImageVariableId(channel) {
  const ch = Math.max(1, parseInt(String(channel), 10) || 1);
  return `highascg_compose_preview_ch${ch}_image`;
}

/** @returns {string} Companion variable id for a compose preview quadrant. */
export function composePreviewQuadrantVariableId(channel, quadrant) {
  const ch = Math.max(1, parseInt(String(channel), 10) || 1);
  return `highascg_compose_preview_ch${ch}_quad_${quadrant}`;
}

/** @param {number[]} channels */
export function buildComposePreviewVariableDefinitions(channels) {
  return channels.flatMap((ch) => {
    const full = {
      variableId: composePreviewImageVariableId(ch),
      name: `Compose preview ch${ch} (button image data URI)`,
    };
    const quads = ["tl", "tr", "bl", "br"].map((quad) => ({
      variableId: composePreviewQuadrantVariableId(ch, quad),
      name: `Compose preview ch${ch} quadrant ${quad.toUpperCase()} (button image)`,
    }));
    return [full, ...quads];
  });
}

/** @returns {typeof buildComposePreviewVariableDefinitions} */
export function getComposePreviewVariableDefinitions(channels = [1, 2, 3]) {
  return buildComposePreviewVariableDefinitions(channels);
}

/** Authoritative HighAsCG UI selection keys (55 total). Same prefix as server `variables`. */
const UI_SELECTION_VARIABLE_DEFINITIONS = [
  { variableId: "highascg_ui_selection_context", name: "UI selection: context" },
  { variableId: "highascg_ui_selection_label", name: "UI selection: label" },
  { variableId: "highascg_ui_selection_look_id", name: "UI selection: look id" },
  { variableId: "highascg_ui_selection_look_name", name: "UI selection: look name" },
  { variableId: "highascg_ui_selection_look_layer_index", name: "UI selection: look layer index" },
  { variableId: "highascg_ui_selection_look_layer_number", name: "UI selection: look layer number" },
  { variableId: "highascg_ui_selection_look_preview_channel", name: "UI selection: look preview channel" },
  { variableId: "highascg_ui_selection_look_caspar_layer", name: "UI selection: look Caspar layer" },
  { variableId: "highascg_ui_selection_look_screen_index", name: "UI selection: look screen index" },
  { variableId: "highascg_ui_selection_look_canvas_w", name: "UI selection: look canvas width" },
  { variableId: "highascg_ui_selection_look_canvas_h", name: "UI selection: look canvas height" },
  { variableId: "highascg_ui_selection_look_fill_x", name: "UI selection: look fill X" },
  { variableId: "highascg_ui_selection_look_fill_y", name: "UI selection: look fill Y" },
  {
    variableId: "highascg_ui_selection_look_fill_scale_x",
    name: "UI selection: look fill scale X",
  },
  {
    variableId: "highascg_ui_selection_look_fill_scale_y",
    name: "UI selection: look fill scale Y",
  },
  { variableId: "highascg_ui_selection_look_rotation", name: "UI selection: look rotation" },
  { variableId: "highascg_ui_selection_look_opacity", name: "UI selection: look opacity" },
  { variableId: "highascg_ui_selection_look_source_type", name: "UI selection: look source type" },
  { variableId: "highascg_ui_selection_look_source_value", name: "UI selection: look source value" },
  { variableId: "highascg_ui_selection_look_source_label", name: "UI selection: look source label" },
  { variableId: "highascg_ui_selection_look_loop", name: "UI selection: look loop" },
  { variableId: "highascg_ui_selection_look_audio_route", name: "UI selection: look audio route" },
  { variableId: "highascg_ui_selection_look_volume", name: "UI selection: look volume" },
  { variableId: "highascg_ui_selection_look_muted", name: "UI selection: look muted" },
  {
    variableId: "highascg_ui_selection_look_straight_alpha",
    name: "UI selection: look straight alpha",
  },
  { variableId: "highascg_ui_selection_look_content_fit", name: "UI selection: look content fit" },
  { variableId: "highascg_ui_selection_look_aspect_locked", name: "UI selection: look aspect locked" },
  {
    variableId: "highascg_ui_selection_look_transition_json",
    name: "UI selection: look transition JSON",
  },
  {
    variableId: "highascg_ui_selection_look_fade_on_end_json",
    name: "UI selection: look fade-on-end JSON",
  },
  {
    variableId: "highascg_ui_selection_look_effects_json",
    name: "UI selection: look effects JSON",
  },
  {
    variableId: "highascg_ui_selection_look_pip_overlays_json",
    name: "UI selection: look PIP overlays JSON",
  },
  {
    variableId: "highascg_ui_selection_look_start_behaviour",
    name: "UI selection: look start behaviour",
  },
  { variableId: "highascg_ui_selection_look_layer_json", name: "UI selection: look layer JSON" },
  { variableId: "highascg_ui_selection_tl_timeline_id", name: "UI selection: TL timeline id" },
  { variableId: "highascg_ui_selection_tl_layer_idx", name: "UI selection: TL layer index" },
  { variableId: "highascg_ui_selection_tl_clip_id", name: "UI selection: TL clip id" },
  { variableId: "highascg_ui_selection_tl_aspect_locked", name: "UI selection: TL aspect locked" },
  { variableId: "highascg_ui_selection_tl_pixel_x", name: "UI selection: TL pixel X" },
  { variableId: "highascg_ui_selection_tl_pixel_y", name: "UI selection: TL pixel Y" },
  { variableId: "highascg_ui_selection_tl_pixel_w", name: "UI selection: TL pixel W" },
  { variableId: "highascg_ui_selection_tl_pixel_h", name: "UI selection: TL pixel H" },
  { variableId: "highascg_ui_selection_tl_fill_x", name: "UI selection: TL fill X" },
  { variableId: "highascg_ui_selection_tl_fill_y", name: "UI selection: TL fill Y" },
  { variableId: "highascg_ui_selection_tl_scale_x", name: "UI selection: TL scale X" },
  { variableId: "highascg_ui_selection_tl_scale_y", name: "UI selection: TL scale Y" },
  { variableId: "highascg_ui_selection_mv_cell_id", name: "UI selection: MV cell id" },
  { variableId: "highascg_ui_selection_mv_layer_index", name: "UI selection: MV layer index" },
  { variableId: "highascg_ui_selection_mv_channel", name: "UI selection: MV channel" },
  { variableId: "highascg_ui_selection_mv_canvas_w", name: "UI selection: MV canvas width" },
  { variableId: "highascg_ui_selection_mv_canvas_h", name: "UI selection: MV canvas height" },
  { variableId: "highascg_ui_selection_mv_x", name: "UI selection: MV X" },
  { variableId: "highascg_ui_selection_mv_y", name: "UI selection: MV Y" },
  { variableId: "highascg_ui_selection_mv_w", name: "UI selection: MV width" },
  { variableId: "highascg_ui_selection_mv_h", name: "UI selection: MV height" },
  {
    variableId: "highascg_ui_selection_mv_aspect_locked",
    name: "UI selection: MV aspect locked",
  },
];

/** @returns {typeof UI_SELECTION_VARIABLE_DEFINITIONS} */
export function getUiSelectionVariableDefinitions() {
  return UI_SELECTION_VARIABLE_DEFINITIONS;
}

/** @returns {typeof TIMELINE_VARIABLE_DEFINITIONS} */
export function getTimelineVariableDefinitions() {
  return TIMELINE_VARIABLE_DEFINITIONS;
}

/**
 * @param {Array<{ variableId: string, name: string }>} defs
 * @returns {Record<string, { name: string }>}
 */
export function variableDefinitionsToObject(defs) {
  /** @type {Record<string, { name: string }>} */
  const out = {};
  for (const d of defs) {
    out[d.variableId] = { name: d.name };
  }
  return out;
}

export function getInitialVariableDefinitions() {
  return variableDefinitionsToObject([
    ...CONNECTION_VARIABLE_DEFINITIONS,
    ...TIMELINE_VARIABLE_DEFINITIONS,
    ...UI_SELECTION_VARIABLE_DEFINITIONS,
  ]);
}

/**
 * @param {import('./instance.js').HighAsCGInstance} instance
 */
export default function getVariables(instance) {
  const base = getInitialVariableDefinitions();
  /** @type {Record<string, { name: string }>} */
  const out = { ...base };

  if (isComposePreviewButtonsEnabled(instance?.config)) {
    const channels = resolveComposePreviewChannels(instance);
    Object.assign(
      out,
      variableDefinitionsToObject(buildComposePreviewVariableDefinitions(channels)),
    );
  }

  const looks = Array.isArray(instance?._presetLooks) ? instance._presetLooks : [];
  /** @type {Record<string, { name: string }>} */
  const lookDefs = {};
  for (const look of looks) {
    const id = String(look?.id ?? "").trim();
    if (!id) continue;
    const shortName = String(look.name || id).slice(0, 48);
    lookDefs[lookLabelVariableId(id)] = {
      name: `Look label: ${shortName}`,
    };
    lookDefs[lookAirFrameVariableId(id)] = {
      name: `Look on-air still: ${shortName}`,
    };
  }
  return { ...out, ...lookDefs };
}
