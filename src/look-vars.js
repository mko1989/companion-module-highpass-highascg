/**
 * Per-look Companion variable id helpers (labels, air preview slugs).
 */

/**
 * @param {string} lookId
 * @returns {string}
 */
export function lookIdSlug(lookId) {
  return String(lookId ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
}

/**
 * @param {string} lookId
 * @returns {string}
 */
export function lookLabelVariableId(lookId) {
  return `highascg_look_label_${lookIdSlug(lookId) || "unknown"}`;
}

/**
 * Push look name changes into Companion label variables.
 *
 * @param {import("./instance.js").HighAsCGInstance} instance
 * @param {Array<{ id: string, name?: string }>} looks
 */
export function syncLookLabelVariables(instance, looks) {
  const list = Array.isArray(looks) ? looks : [];
  /** @type {Record<string, string>} */
  const values = {};
  for (const look of list) {
    const id = String(look?.id ?? "").trim();
    if (!id) continue;
    values[lookLabelVariableId(id)] = String(look.name || "Look").slice(0, 120);
  }
  if (Object.keys(values).length > 0) {
    instance.setVariableValues(values);
  }
}
