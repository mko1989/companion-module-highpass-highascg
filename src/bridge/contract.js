/**
 * HighAsCG ↔ companion-module-highpass-highascg bridge contract.
 * Keep in sync with highascg/src/companion-bridge/contract.js
 */

/** @typedef {'tl' | 'tr' | 'bl' | 'br'} ComposePreviewQuadrant */

export const MODULE_ID = "highpass-highascg";

export const WS = {
  COMPANION_HELLO: "companion.hello",
  VARIABLE_UPDATE: "variable_update",
  COMPOSE_PREVIEW: "compose.preview",
  STATE: "state",
};

export const PREVIEW = {
  COMPOSE_IMAGE_RE: /^compose_preview_ch(\d+)_image$/,
  COMPOSE_QUAD_RE: /^compose_preview_ch(\d+)_quad_(tl|tr|bl|br)$/,
  LOOK_AIR_FRAME_RE: /^look_air_frame_[a-zA-Z0-9_-]+$/,
};

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
 * @param {number} channel
 * @returns {string}
 */
export function composePreviewImageKey(channel) {
  const ch = Math.max(1, parseInt(String(channel), 10) || 1);
  return `compose_preview_ch${ch}_image`;
}

/**
 * @param {number} channel
 * @param {ComposePreviewQuadrant} quadrant
 * @returns {string}
 */
export function composePreviewQuadrantKey(channel, quadrant) {
  const ch = Math.max(1, parseInt(String(channel), 10) || 1);
  return `compose_preview_ch${ch}_quad_${quadrant}`;
}

/**
 * @param {string} lookId
 * @returns {string}
 */
export function lookAirFrameKey(lookId) {
  return `look_air_frame_${lookIdSlug(lookId) || "unknown"}`;
}

/**
 * @param {string} serverKey
 * @returns {string}
 */
export function companionVariableId(serverKey) {
  return `highascg_${String(serverKey ?? "")}`;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isComposePreviewServerKey(key) {
  const k = String(key);
  return (
    PREVIEW.COMPOSE_IMAGE_RE.test(k) ||
    PREVIEW.COMPOSE_QUAD_RE.test(k) ||
    PREVIEW.LOOK_AIR_FRAME_RE.test(k)
  );
}

/**
 * @param {object} [preview]
 * @returns {{ enabled: boolean, channels: number[], quadrants: boolean, lookAirFrames: boolean }}
 */
export function normalizeHelloPreview(preview) {
  const p = preview && typeof preview === "object" ? preview : {};
  const enabled = p.enabled !== false;
  /** @type {number[]} */
  const channels = [];
  if (Array.isArray(p.channels)) {
    for (const raw of p.channels) {
      const ch = parseInt(String(raw), 10);
      if (Number.isFinite(ch) && ch > 0) channels.push(ch);
    }
  }
  return {
    enabled,
    channels: [...new Set(channels)].sort((a, b) => a - b),
    quadrants: p.quadrants === true,
    lookAirFrames: p.lookAirFrames !== false,
  };
}
