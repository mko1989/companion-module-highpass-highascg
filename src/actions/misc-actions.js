/**
 * @file misc-actions.js
 * Audio and Caspar log level actions.
 */

export default function (instance) {
  return {
    audio_volume: {
      name: "Audio Volume (Unified)",
      options: [
        {
          type: "number",
          label: "Channel",
          id: "channel",
          default: 1,
          min: 1,
          max: 8,
        },
        {
          type: "number",
          label: "Layer",
          id: "layer",
          default: 0,
          min: 0,
          max: 99,
          help: "0 for Master Volume",
        },
        {
          type: "number",
          label: "Volume (dB)",
          id: "volume",
          default: 0,
          min: -60,
          max: 6,
        },
      ],
      callback: async (action) => {
        if (instance.bridge && instance.bridge.api) {
          const { channel, layer, volume } = action.options;
          await instance.bridge.api.setAudioVolume(
            channel,
            volume,
            layer === 0 ? null : layer,
          );
        }
      },
    },

    log_level: {
      name: "Set CasparCG Log Level",
      options: [
        {
          type: "dropdown",
          label: "Level",
          id: "level",
          default: "info",
          choices: [
            { id: "trace", label: "Trace" },
            { id: "debug", label: "Debug" },
            { id: "info", label: "Info" },
            { id: "warning", label: "Warning" },
            { id: "error", label: "Error" },
            { id: "fatal", label: "Fatal" },
          ],
        },
      ],
      callback: async (action) => {
        if (instance.bridge && instance.bridge.api) {
          await instance.bridge.api.setLogLevel(action.options.level);
        }
      },
    },
  };
}
