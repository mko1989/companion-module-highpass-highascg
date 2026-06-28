/**
 * @file mixer-layer-actions.js
 * Direct channel/layer mixer and effect actions.
 */

import {
  baseChannelLayerOptions,
  EFFECT_TYPE_CHOICES,
  mixerTransitionOptions,
  parseTransitionOptions,
} from "./action-options.js";

export default function (instance) {
  return {
    layer_fill: {
      name: "Layer: Fill",
      options: [
        ...baseChannelLayerOptions(),
        { type: "number", id: "x", label: "X", default: 0, min: -4, max: 4 },
        { type: "number", id: "y", label: "Y", default: 0, min: -4, max: 4 },
        {
          type: "number",
          id: "xScale",
          label: "X Scale",
          default: 1,
          min: 0,
          max: 8,
        },
        {
          type: "number",
          id: "yScale",
          label: "Y Scale",
          default: 1,
          min: 0,
          max: 8,
        },
        { type: "checkbox", id: "stretch", label: "Stretch", default: false },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const body = {
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          x: Number(action.options.x),
          y: Number(action.options.y),
          xScale: Number(action.options.xScale),
          yScale: Number(action.options.yScale),
          stretch: action.options.stretch ? 1 : 0,
          ...parseTransitionOptions(action.options),
        };
        await instance.bridge.api.mixerFill(body);
      },
    },

    layer_clip: {
      name: "Layer: Clip",
      options: [
        ...baseChannelLayerOptions(),
        { type: "number", id: "x", label: "X", default: 0, min: -4, max: 4 },
        { type: "number", id: "y", label: "Y", default: 0, min: -4, max: 4 },
        {
          type: "number",
          id: "xScale",
          label: "X Scale",
          default: 1,
          min: 0,
          max: 8,
        },
        {
          type: "number",
          id: "yScale",
          label: "Y Scale",
          default: 1,
          min: 0,
          max: 8,
        },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        await instance.bridge.api.mixerClip({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          x: Number(action.options.x),
          y: Number(action.options.y),
          xScale: Number(action.options.xScale),
          yScale: Number(action.options.yScale),
          ...parseTransitionOptions(action.options),
        });
      },
    },

    layer_anchor: {
      name: "Layer: Anchor",
      options: [
        ...baseChannelLayerOptions(),
        { type: "number", id: "x", label: "X", default: 0, min: -1, max: 1 },
        { type: "number", id: "y", label: "Y", default: 0, min: -1, max: 1 },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        await instance.bridge.api.mixerAnchor({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          x: Number(action.options.x),
          y: Number(action.options.y),
          ...parseTransitionOptions(action.options),
        });
      },
    },

    layer_rotation: {
      name: "Layer: Rotation",
      options: [
        ...baseChannelLayerOptions(),
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
        await instance.bridge.api.mixerRotation({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          degrees: Number(action.options.degrees),
          ...parseTransitionOptions(action.options),
        });
      },
    },

    layer_opacity: {
      name: "Layer: Opacity",
      options: [
        ...baseChannelLayerOptions(),
        {
          type: "number",
          id: "opacity",
          label: "Opacity (0-1)",
          default: 1,
          min: 0,
          max: 1,
        },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        await instance.bridge.api.mixerOpacity({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          opacity: Number(action.options.opacity),
          ...parseTransitionOptions(action.options),
        });
      },
    },

    layer_keyer: {
      name: "Layer: Keyer",
      options: [
        ...baseChannelLayerOptions(),
        {
          type: "checkbox",
          id: "keyer",
          label: "Enable keyer",
          default: false,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        await instance.bridge.api.mixerKeyer({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          keyer: action.options.keyer ? 1 : 0,
        });
      },
    },

    layer_audio_volume: {
      name: "Layer: Audio Volume",
      options: [
        ...baseChannelLayerOptions(),
        {
          type: "number",
          id: "volume",
          label: "Volume (dB)",
          default: 0,
          min: -60,
          max: 12,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        await instance.bridge.api.setAudioVolume(
          Number(action.options.channel),
          Number(action.options.volume),
          Number(action.options.layer),
        );
      },
    },

    mixer_commit: {
      name: "Mixer: Commit deferred",
      options: [
        {
          type: "number",
          label: "Channel",
          id: "channel",
          default: 1,
          min: 1,
          max: 8,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        await instance.bridge.api.mixerCommit({
          channel: Number(action.options.channel),
        });
      },
    },

    layer_mixer_clear: {
      name: "Layer: Mixer clear",
      options: [...baseChannelLayerOptions()],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        await instance.bridge.api.mixerClear({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
        });
      },
    },

    layer_effect: {
      name: "Layer: Effect",
      options: [
        ...baseChannelLayerOptions(),
        {
          type: "dropdown",
          id: "effectType",
          label: "Effect type",
          default: "brightness",
          choices: EFFECT_TYPE_CHOICES,
        },
        {
          type: "textinput",
          id: "params_json",
          label: "Params JSON",
          default: '{"value":1}',
        },
        ...mixerTransitionOptions(),
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        let params;
        try {
          params = JSON.parse(String(action.options.params_json || "{}"));
        } catch (e) {
          instance.log("error", `Layer effect params JSON invalid: ${e.message}`);
          return;
        }
        await instance.bridge.api.mixerEffect({
          channel: Number(action.options.channel),
          layer: Number(action.options.layer),
          effectType: String(action.options.effectType),
          params,
          ...parseTransitionOptions(action.options),
        });
      },
    },
  };
}
