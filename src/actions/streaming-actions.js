/**
 * @file streaming-actions.js
 * Stream/record start-stop for the CONFIGURED outputs (WO-395).
 *
 * No free-text placeholders: the dropdowns list the outputs actually set on the box
 * (GET /api/streaming-channel `outputs`), and the server resolves URL/key/quality/codecs
 * from that output config + the active project (WO-244/261/307 credential rules).
 * Action ids are unchanged from WO-170 so existing buttons keep working.
 */

import {
  streamOutputChoices,
  recordOutputChoices,
} from "../streaming-outputs.js";

export default function (instance) {
  const streamChoices = streamOutputChoices(instance);
  const recordStartChoices = recordOutputChoices(instance);
  const recordStopChoices = recordOutputChoices(instance, { includeAll: true });

  return {
    rtmp_start: {
      name: "Stream: Start output",
      options: [
        {
          type: "dropdown",
          id: "output_id",
          label: "Stream output (configured on the box)",
          default: streamChoices[0]?.id ?? "",
          choices: streamChoices,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const outputId = String(action.options.output_id || "").trim();
        if (!outputId) {
          instance.log(
            "warn",
            "Stream start: no stream output configured/selected",
          );
          return;
        }
        try {
          await instance.bridge.api.rtmpStreaming({
            action: "start",
            outputId,
          });
        } catch (e) {
          instance.log("error", `Stream start: ${e.message || e}`);
        }
      },
    },

    rtmp_stop: {
      name: "Stream: Stop",
      options: [],
      callback: async () => {
        if (!instance.bridge?.api) return;
        try {
          await instance.bridge.api.rtmpStreaming({ action: "stop" });
        } catch (e) {
          instance.log("error", `Stream stop: ${e.message || e}`);
        }
      },
    },

    record_start: {
      name: "Record: Start output",
      options: [
        {
          type: "dropdown",
          id: "output_id",
          label: "Record output (configured on the box)",
          default: recordStartChoices[0]?.id ?? "",
          choices: recordStartChoices,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const outputId = String(action.options.output_id || "").trim();
        if (!outputId) {
          instance.log(
            "warn",
            "Record start: no record output configured/selected",
          );
          return;
        }
        try {
          await instance.bridge.api.recordStreaming({
            action: "start",
            outputId,
          });
        } catch (e) {
          instance.log("error", `Record start: ${e.message || e}`);
        }
      },
    },

    record_stop: {
      name: "Record: Stop",
      options: [
        {
          type: "dropdown",
          id: "output_id",
          label: "Record output",
          default: "",
          choices: recordStopChoices,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const opts = { action: "stop" };
        const outputId = String(action.options.output_id || "").trim();
        if (outputId) opts.outputId = outputId;
        try {
          await instance.bridge.api.recordStreaming(opts);
        } catch (e) {
          instance.log("error", `Record stop: ${e.message || e}`);
        }
      },
    },
  };
}
