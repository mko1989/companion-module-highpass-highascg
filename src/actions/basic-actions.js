/**
 * @file basic-actions.js
 * Standard AMCP actions using direct TCP.
 */

export default function (instance) {
  return {
    play: {
      name: "Play Clip",
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
          default: 10,
          min: 1,
          max: 99,
        },
        { type: "textinput", label: "Clip", id: "clip", default: "" },
        { type: "checkbox", label: "Loop", id: "loop", default: false },
      ],
      callback: async (action) => {
        const { channel, layer, clip, loop } = action.options;
        let cmd = `PLAY ${channel}-${layer} "${clip}"`;
        if (loop) cmd += " LOOP";
        instance.tcp.sendCommand(cmd);
      },
    },
    stop: {
      name: "Stop Layer",
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
          default: 10,
          min: 1,
          max: 99,
        },
      ],
      callback: async (action) => {
        const { channel, layer } = action.options;
        instance.tcp.sendCommand(`STOP ${channel}-${layer}`);
      },
    },
    clear: {
      name: "Clear Channel/Layer",
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
        },
      ],
      callback: async (action) => {
        const { channel, layer } = action.options;
        const target = layer === 0 ? String(channel) : `${channel}-${layer}`;
        instance.tcp.sendCommand(`CLEAR ${target}`);
      },
    },
    raw: {
      name: "Raw AMCP Command",
      options: [
        { type: "textinput", label: "Command", id: "cmd", default: "" },
      ],
      callback: async (action) => {
        instance.tcp.sendCommand(action.options.cmd);
      },
    },
  };
}
