/**
 * @file pip-overlay-actions.js
 * PIP overlay stack actions.
 */

import { baseChannelLayerOptions } from "./action-options.js";

export default function (instance) {
  return {
    pip_overlay_apply: {
      name: "PIP Overlay: Apply",
      options: [
        ...baseChannelLayerOptions(),
        {
          type: "number",
          id: "stackIndex",
          label: "Stack index",
          default: 0,
          min: 0,
          max: 64,
        },
        {
          type: "textinput",
          id: "overlay_json",
          label: "Overlay JSON",
          default: '{"type":"border","params":{"color":"#ffffff","width":0.01}}',
        },
        {
          type: "textinput",
          id: "fill_json",
          label: "Fill JSON",
          default: '{"x":0,"y":0,"scaleX":1,"scaleY":1}',
        },
        {
          type: "number",
          id: "nextContentLayer",
          label: "Next content layer (optional, 0 = omit)",
          default: 0,
          min: 0,
          max: 9999,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        let overlay;
        let fill;
        try {
          overlay = JSON.parse(String(action.options.overlay_json || "{}"));
          fill = JSON.parse(String(action.options.fill_json || "{}"));
        } catch (e) {
          instance.log("error", `PIP apply JSON invalid: ${e.message}`);
          return;
        }
        const nextContentLayer = Number(action.options.nextContentLayer);
        await instance.bridge.api.pipOverlayApply({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          stackIndex: Number(action.options.stackIndex),
          overlay,
          fill,
          ...(nextContentLayer > 0 ? { nextContentLayer } : {}),
        });
      },
    },

    pip_overlay_update: {
      name: "PIP Overlay: Update",
      options: [
        ...baseChannelLayerOptions(),
        {
          type: "number",
          id: "stackIndex",
          label: "Stack index",
          default: 0,
          min: 0,
          max: 64,
        },
        {
          type: "textinput",
          id: "overlay_json",
          label: "Overlay JSON",
          default: '{"type":"border","params":{"color":"#ffffff","width":0.01}}',
        },
        {
          type: "textinput",
          id: "fill_json",
          label: "Fill JSON",
          default: '{"x":0,"y":0,"scaleX":1,"scaleY":1}',
        },
        {
          type: "number",
          id: "nextContentLayer",
          label: "Next content layer (optional, 0 = omit)",
          default: 0,
          min: 0,
          max: 9999,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        let overlay;
        let fill;
        try {
          overlay = JSON.parse(String(action.options.overlay_json || "{}"));
          fill = JSON.parse(String(action.options.fill_json || "{}"));
        } catch (e) {
          instance.log("error", `PIP update JSON invalid: ${e.message}`);
          return;
        }
        const nextContentLayer = Number(action.options.nextContentLayer);
        await instance.bridge.api.pipOverlayUpdate({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          stackIndex: Number(action.options.stackIndex),
          overlay,
          fill,
          ...(nextContentLayer > 0 ? { nextContentLayer } : {}),
        });
      },
    },

    pip_overlay_remove: {
      name: "PIP Overlay: Remove",
      options: [
        ...baseChannelLayerOptions(),
        {
          type: "number",
          id: "nextContentLayer",
          label: "Next content layer (optional, 0 = omit)",
          default: 0,
          min: 0,
          max: 9999,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const nextContentLayer = Number(action.options.nextContentLayer);
        await instance.bridge.api.pipOverlayRemove({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          ...(nextContentLayer > 0 ? { nextContentLayer } : {}),
        });
      },
    },
  };
}
