/**
 * HighAsCG ↔ companion-module-highpass-highascg bridge contract.
 * Keep in sync with highascg/src/companion-bridge/contract.js
 */

export const MODULE_ID = "highpass-highascg";

export const WS = {
  COMPANION_HELLO: "companion.hello",
  VARIABLE_UPDATE: "variable_update",
  STATE: "state",
};

/** Server variable keys that carry a button image (data URI) — never taken into Companion. */
const BUTTON_IMAGE_KEY_RE =
  /^(compose_preview_ch\d+_(image|quad_(tl|tr|bl|br))|look_air_frame_[a-zA-Z0-9_-]+)$/;

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isButtonImageServerKey(key) {
  return BUTTON_IMAGE_KEY_RE.test(String(key));
}

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
 * @param {string} serverKey
 * @returns {string}
 */
export function companionVariableId(serverKey) {
  return `highascg_${String(serverKey ?? "")}`;
}
