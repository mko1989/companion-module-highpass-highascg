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

/** How many screens get a label variable (HighAsCG allows up to 4 main screens). */
export const SCREEN_LABEL_COUNT = 4;

/**
 * @param {number} screenIndex — 0-based
 * @returns {string} variable id carrying the screen's CURRENT display name
 */
export function screenLabelVariableId(screenIndex) {
  const n = Math.max(0, parseInt(String(screenIndex), 10) || 0);
  return `highascg_screen_${n + 1}_label`;
}

/** @returns {{ variableId: string, name: string }[]} */
export function screenLabelVariableDefinitions() {
  const defs = [];
  for (let i = 0; i < SCREEN_LABEL_COUNT; i += 1) {
    defs.push({
      variableId: screenLabelVariableId(i),
      name: `Screen ${i + 1}: display name (custom label, else S${i + 1})`,
    });
  }
  return defs;
}

/**
 * Screen display name, mirroring the web UI's screenLabel() (WO-222): a custom label when the
 * operator set one, else `S<n>`.
 * @param {object | null | undefined} channelMap
 * @param {number} screenIndex — 0-based
 */
export function screenDisplayLabel(channelMap, screenIndex) {
  const labels = channelMap?.screenLabels;
  if (Array.isArray(labels) && labels[screenIndex])
    return String(labels[screenIndex]);
  return `S${screenIndex + 1}`;
}

/**
 * Push screen names into their variables, so a preset button captioned with
 * `$(conn:highascg_screen_N_label)` follows a rename in HighAsCG.
 * @param {import("./instance.js").HighAsCGInstance} instance
 */
export function syncScreenLabelVariables(instance) {
  const map = instance?._channelMap;
  /** @type {Record<string, string>} */
  const values = {};
  for (let i = 0; i < SCREEN_LABEL_COUNT; i += 1) {
    values[screenLabelVariableId(i)] = screenDisplayLabel(map, i);
  }
  instance.setVariableValues(values);
}

/** How many look slots get a label variable — mirrors SLOT_COUNT in presets.js. */
export const LOOK_SLOT_COUNT = 20;

/**
 * @param {number} slot
 * @returns {string} variable id carrying the CURRENT name of whatever look is in this slot
 */
export function lookSlotLabelVariableId(slot) {
  return `highascg_look_slot_${Math.max(1, parseInt(String(slot), 10) || 1)}_label`;
}

/** @returns {{ variableId: string, name: string }[]} */
export function lookSlotLabelVariableDefinitions() {
  const defs = [];
  for (let slot = 1; slot <= LOOK_SLOT_COUNT; slot += 1) {
    defs.push({
      variableId: lookSlotLabelVariableId(slot),
      name: `Look slot ${slot}: name of the look in the slot`,
    });
  }
  return defs;
}

/**
 * Push slot → look-name into the slot label variables.
 *
 * A preset's style is COPIED onto the button when it is dragged out, so a name baked into the
 * text at preset-build time is frozen there for good (owner 2026-07-29: "when a look gets a
 * different title it still stays look 1 in companion"). The preset text references these
 * variables instead, and renaming a look — or moving it to another slot — re-renders the button.
 *
 * @param {import("./instance.js").HighAsCGInstance} instance
 */
export function syncLookSlotLabelVariables(instance) {
  const looks = Array.isArray(instance?._presetLooks)
    ? instance._presetLooks
    : [];
  /** @type {Record<string, string>} */
  const values = {};
  for (let slot = 1; slot <= LOOK_SLOT_COUNT; slot += 1) {
    const lookId = instance.getLookIdForSlot?.(slot);
    const look = lookId
      ? looks.find((l) => String(l.id) === String(lookId))
      : null;
    values[lookSlotLabelVariableId(slot)] = look
      ? String(look.name || look.id).slice(0, 120)
      : "";
  }
  instance.setVariableValues(values);
}
