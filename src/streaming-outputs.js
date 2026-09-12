/**
 * @file streaming-outputs.js
 * Configured stream/record output catalog (WO-395).
 *
 * Sourced from GET /api/streaming-channel `outputs` (safe summaries: id/label/enabled/type —
 * the server never sends URLs or keys; credentials resolve server-side on start). Cached on
 * `instance._streamingOutputs` by the streaming-channel poller / WS broadcast handler, which
 * rebuild actions/feedbacks/presets when the catalog changes.
 */

/** @returns {{ id: string, label: string, enabled: boolean, type?: string }[]} */
export function getStreamOutputs(instance) {
  const list = instance?._streamingOutputs?.stream;
  return Array.isArray(list) ? list.filter((o) => o && o.id) : [];
}

/** @returns {{ id: string, label: string, enabled: boolean }[]} */
export function getRecordOutputs(instance) {
  const list = instance?._streamingOutputs?.record;
  return Array.isArray(list) ? list.filter((o) => o && o.id) : [];
}

function outputLabel(o) {
  const label = String(o.label || o.id);
  return o.enabled === false ? `${label} (disabled)` : label;
}

/**
 * Dropdown choices — only the outputs that are actually configured on the box.
 * With none configured (valid since WO-393), a single explanatory entry keeps the
 * dropdown renderable; the actions no-op on the empty id.
 */
export function streamOutputChoices(instance) {
  const outs = getStreamOutputs(instance);
  if (!outs.length)
    return [{ id: "", label: "No stream outputs configured on the box" }];
  return outs.map((o) => ({ id: o.id, label: outputLabel(o) }));
}

/** @param {{ includeAll?: boolean }} [opts] */
export function recordOutputChoices(instance, opts = {}) {
  const outs = getRecordOutputs(instance);
  const choices = outs.map((o) => ({ id: o.id, label: outputLabel(o) }));
  if (opts.includeAll)
    choices.unshift({ id: "", label: "All active recordings" });
  if (!choices.length)
    return [{ id: "", label: "No record outputs configured on the box" }];
  return choices;
}
