/**
 * Build companion.hello payload for HighAsCG WebSocket bridge.
 */

import { MODULE_ID, WS } from "./contract.js";
import {
  isComposePreviewButtonsEnabled,
  resolveComposePreviewChannels,
} from "../compose-preview-channels.js";

/** @typedef {import('../instance.js').HighAsCGInstance} HighAsCGInstance */

/**
 * @param {HighAsCGInstance} instance
 * @returns {{ type: string, data: object }}
 */
export function buildCompanionHelloMessage(instance) {
  const enabled = isComposePreviewButtonsEnabled(instance?.config);
  return {
    type: WS.COMPANION_HELLO,
    data: {
      moduleId: MODULE_ID,
      moduleVersion: "1.0.1",
      instanceId: String(instance?.id ?? "").trim(),
      preview: {
        enabled,
        channels: enabled ? resolveComposePreviewChannels(instance) : [],
        quadrants: enabled,
        lookAirFrames: enabled,
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
