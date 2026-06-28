/**
 * Resolve HighAsCG inspector UI selection → Caspar channel/layer + fill geometry.
 * Keys match HighAsCG `apply-ui-selection-variables` (see companion `ui_selection.md`).
 *
 * `ui_selection_context`: none | scene_layer | timeline_clip | multiview
 */

/** @param {unknown} sync */
function _get(sync, key) {
  if (!sync || typeof sync.getServerVariable !== "function") return "";
  return sync.getServerVariable(key);
}

function _parseFinite(keys, sync, fallback = NaN) {
  for (const k of keys) {
    const s = String(_get(sync, k) ?? "").trim();
    if (s === "") continue;
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/**
 * Mixer routing for live layer paint — looks editor only (`scene_layer`).
 * @param {{ bridge?: { sync?: object } }} instance
 * @returns {{ ok: boolean, reason?: string, context?: string, channel?: number, layer?: number }}
 */
function resolveUiLayerRouting(instance) {
  const sync = instance.bridge?.sync;
  if (!sync) return { ok: false, reason: "HighAsCG bridge offline" };

  const ctx = String(_get(sync, "ui_selection_context") ?? "").trim();

  if (ctx !== "scene_layer") {
    return {
      ok: false,
      context: ctx || undefined,
      reason:
        ctx === "timeline_clip" || ctx === "multiview"
          ? `context "${ctx}" has no mixer route (select a look editor layer for paint actions)`
          : ctx
            ? `context "${ctx}" has no mixer route`
            : "no UI selection",
    };
  }

  const channel = _parseFinite(["ui_selection_look_preview_channel"], sync);
  const layer = _parseFinite(
    ["ui_selection_look_caspar_layer", "ui_selection_look_layer_number"],
    sync,
  );

  if (Number.isFinite(channel) && Number.isFinite(layer)) {
    return { ok: true, context: ctx, channel, layer };
  }

  return {
    ok: false,
    context: ctx,
    reason: "scene_layer: missing preview channel or Caspar layer vars",
  };
}

/**
 * Read fill / scale for relative nudge actions.
 * - scene_layer: look editor keys (`ui_selection_look_fill_*`, `fill_scale_*`).
 * - timeline_clip: timeline keys (for reference / future use; mixer actions still need scene_layer routing).
 * @param {{ bridge?: { sync?: object } }} instance
 */
function readUiSelectionFill(instance) {
  const sync = instance.bridge?.sync;
  const ctx = String(_get(sync, "ui_selection_context") ?? "").trim();

  if (ctx === "timeline_clip") {
    return {
      context: ctx,
      x: _parseFinite(["ui_selection_tl_fill_x"], sync, 0),
      y: _parseFinite(["ui_selection_tl_fill_y"], sync, 0),
      xScale: _parseFinite(["ui_selection_tl_scale_x"], sync, 1),
      yScale: _parseFinite(["ui_selection_tl_scale_y"], sync, 1),
    };
  }

  if (ctx !== "scene_layer") {
    return {
      context: ctx,
      x: 0,
      y: 0,
      xScale: 1,
      yScale: 1,
    };
  }

  const xKeys = ["ui_selection_look_fill_x"];
  const yKeys = ["ui_selection_look_fill_y"];
  const xsKeys = [
    "ui_selection_look_fill_scale_x",
    "ui_selection_look_fill_x_scale",
    "ui_selection_look_fill_xScale",
  ];
  const ysKeys = [
    "ui_selection_look_fill_scale_y",
    "ui_selection_look_fill_y_scale",
    "ui_selection_look_fill_yScale",
  ];

  return {
    context: ctx,
    x: _parseFinite(xKeys, sync, 0),
    y: _parseFinite(yKeys, sync, 0),
    xScale: _parseFinite(xsKeys, sync, 1),
    yScale: _parseFinite(ysKeys, sync, 1),
  };
}

export { resolveUiLayerRouting, readUiSelectionFill };
