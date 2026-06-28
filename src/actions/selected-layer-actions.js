/**
 * @file selected-layer-actions.js
 * Mixer actions targeting the HighAsCG UI-selected layer.
 */

import { resolveUiLayerRouting } from "../ui-selection.js";
import {
  applyMixerFillToUiSelection,
  mixerTransitionOptions,
  parseTransitionOptions,
} from "./action-options.js";

export default function (instance) {
  return {
    sel_layer_fill: {
      name: "Selected layer: Fill (absolute)",
      options: [
        { type: "number", id: "x", label: "X", default: 0, min: -4, max: 4 },
        { type: "number", id: "y", label: "Y", default: 0, min: -4, max: 4 },
        {
          type: "number",
          id: "xScale",
          label: "X scale",
          default: 1,
          min: 0,
          max: 8,
        },
        {
          type: "number",
          id: "yScale",
          label: "Y scale",
          default: 1,
          min: 0,
          max: 8,
        },
        { type: "checkbox", id: "stretch", label: "Stretch", default: false },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        await applyMixerFillToUiSelection(
          instance,
          {
            x: Number(action.options.x),
            y: Number(action.options.y),
            xScale: Number(action.options.xScale),
            yScale: Number(action.options.yScale),
            stretch: action.options.stretch ? 1 : 0,
          },
          action.options,
        );
      },
    },

    sel_layer_fill_relative: {
      name: "Selected layer: Fill (relative)",
      options: [
        {
          type: "textinput",
          id: "dx",
          label: "Delta X",
          default: 0.01,
          min: -4,
          max: 4,
        },
        {
          type: "textinput",
          id: "dy",
          label: "Delta Y",
          default: 0.01,
          min: -4,
          max: 4,
        },
        {
          type: "textinput",
          id: "dxScale",
          label: "Delta X scale",
          default: 0,
          min: -4,
          max: 4,
        },
        {
          type: "textinput",
          id: "dyScale",
          label: "Delta Y scale",
          default: 0,
          min: -4,
          max: 4,
        },
        { type: "checkbox", id: "stretch", label: "Stretch", default: false },
        { type: "textinput", id: "speed_var", label: "Speed variable (e.g. $(instance:speed))", default: "" },
        ...mixerTransitionOptions(1),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) {
          instance.log("warn", "Cannot run action: Bridge API not available");
          return;
        }
        
        const parseVar = (val) => {
          if (val === undefined || val === null || val === "") return 0;
          const num = Number(val);
          return Number.isFinite(num) ? num : 0;
        };
        
        const dx = parseVar(action.options.dx);
        const dy = parseVar(action.options.dy);
        const dxScale = parseVar(action.options.dxScale);
        const dyScale = parseVar(action.options.dyScale);

        const buildRelative = (v) => {
          return v >= 0 ? `+${v}` : `${v}`;
        };

        const fillBody = {
          x: buildRelative(dx),
          y: buildRelative(dy),
          xScale: buildRelative(dxScale),
          yScale: buildRelative(dyScale),
        };

        if (action.options.stretch) fillBody.stretch = 1;

        if (instance._relativeMoveTimeout) {
          clearTimeout(instance._relativeMoveTimeout);
          instance._relativeMoveTimeout = null;
        }

        const runMove = async () => {
          const speedVarStr = String(action.options.speed_var || "").trim();
          let interval = 500; // Default

          if (speedVarStr !== "") {
            const speedVal = Number(speedVarStr);
            
            if (speedVal === 0) {
              instance._relativeMoveStop = true;
              return;
            }

            if (Number.isFinite(speedVal)) {
              interval = Math.round(25000 / Math.abs(speedVal));
              interval = Math.max(10, Math.min(1000, interval));
            }
          }

          try {
            await applyMixerFillToUiSelection(
              instance,
              fillBody,
              action.options,
            );
          } catch (e) {
            instance.log("error", `Continuous move error: ${e.message || e}`);
            instance._relativeMoveStop = true;
          }
          
          if (!instance._relativeMoveStop) {
            instance._relativeMoveTimeout = setTimeout(runMove, interval);
          }
        };

        instance._relativeMoveStop = false;
        instance._relativeMoveTimeout = setTimeout(runMove, 10);
      },
    },

    sel_layer_fill_relative_stop: {
      name: "Selected layer: Fill (relative stop)",
      options: [],
      callback: async (action) => {
        instance._relativeMoveStop = true;
        if (instance._relativeMoveTimeout) {
          clearTimeout(instance._relativeMoveTimeout);
          instance._relativeMoveTimeout = null;
        }
      },
    },

    sel_layer_opacity: {
      name: "Selected layer: Opacity",
      options: [
        {
          type: "number",
          id: "opacity",
          label: "Opacity (0–1)",
          default: 1,
          min: 0,
          max: 1,
        },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const route = resolveUiLayerRouting(instance);
        if (!route.ok) {
          instance.log(
            "warn",
            `Selected layer opacity: ${route.reason || "cannot resolve"}`,
          );
          return;
        }
        await instance.bridge.api.mixerOpacity({
          channel: route.channel,
          layer: route.layer,
          opacity: Number(action.options.opacity),
          ...parseTransitionOptions(action.options),
        });
      },
    },

    sel_layer_opacity_relative: {
      name: "Selected layer: Opacity (relative)",
      options: [
        {
          type: "textinput",
          id: "dOpacity",
          label: "Delta Opacity",
          default: 0,
          min: -1,
          max: 1,
        },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const route = resolveUiLayerRouting(instance);
        if (!route.ok) {
          instance.log(
            "warn",
            `Selected layer opacity relative: ${route.reason || "cannot resolve"}`,
          );
          return;
        }
        const d = Number(action.options.dOpacity);
        if (d === 0) return;
        const opacityStr = d > 0 ? `+${d}` : `${d}`;
        await instance.bridge.api.mixerOpacity({
          channel: route.channel,
          layer: route.layer,
          opacity: opacityStr,
          ...parseTransitionOptions(action.options),
        });
      },
    },

    sel_layer_rotation: {
      name: "Selected layer: Rotation",
      options: [
        {
          type: "number",
          id: "degrees",
          label: "Degrees",
          default: 0,
          min: -360,
          max: 360,
        },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const route = resolveUiLayerRouting(instance);
        if (!route.ok) {
          instance.log(
            "warn",
            `Selected layer rotation: ${route.reason || "cannot resolve"}`,
          );
          return;
        }
        await instance.bridge.api.mixerRotation({
          channel: route.channel,
          layer: route.layer,
          degrees: Number(action.options.degrees),
          ...parseTransitionOptions(action.options),
        });
      },
    },
  };
}
