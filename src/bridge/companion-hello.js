/**
 * Build companion.hello payload for HighAsCG WebSocket bridge.
 */

import { MODULE_ID, WS } from "./contract.js";

/** @typedef {import('../instance.js').HighAsCGInstance} HighAsCGInstance */

/**
 * @param {HighAsCGInstance} instance
 * @returns {{ type: string, data: object }}
 */
export function buildCompanionHelloMessage(instance) {
  return {
    type: WS.COMPANION_HELLO,
    data: {
      moduleId: MODULE_ID,
      moduleVersion: "1.0.6",
      instanceId: String(instance?.id ?? "").trim(),
      // The module shows no button images: tell the server not to render or push any.
      preview: {
        enabled: false,
        channels: [],
        quadrants: false,
        lookAirFrames: false,
      },
    },
  };
}

/**
 * @param {HighAsCGInstance} instance
 */
export function sendCompanionHello(instance) {
  const ws = instance.bridge?.ws?.ws;
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(buildCompanionHelloMessage(instance)));
    instance.log("debug", "HighAsCG companion.hello sent");
  } catch (e) {
    instance.log("warn", `HighAsCG companion.hello failed: ${e?.message || e}`);
  }
}
