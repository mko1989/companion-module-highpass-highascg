/**
 * @file countdown-actions.js
 * Countdown timer template control actions (WO-169).
 */

export default function (instance) {
  return {
    countdown_start: {
      name: "Countdown: Start",
      options: [
        {
          type: "number",
          id: "channel",
          label: "CasparCG channel",
          default: 1,
          min: 1,
          max: 8,
        },
        {
          type: "number",
          id: "layer",
          label: "Logical layer number",
          default: 10,
          min: 0,
          max: 9999,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const channel = Math.max(1, parseInt(action.options.channel, 10) || 1);
        const layer = Math.max(0, parseInt(action.options.layer, 10) || 10);
        try {
          await instance.bridge.api.countdownControl("start", {
            channel,
            layer,
          });
        } catch (e) {
          instance.log("error", `Countdown start: ${e.message || e}`);
        }
      },
    },

    countdown_pause: {
      name: "Countdown: Pause",
      options: [
        {
          type: "number",
          id: "channel",
          label: "CasparCG channel",
          default: 1,
          min: 1,
          max: 8,
        },
        {
          type: "number",
          id: "layer",
          label: "Logical layer number",
          default: 10,
          min: 0,
          max: 9999,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const channel = Math.max(1, parseInt(action.options.channel, 10) || 1);
        const layer = Math.max(0, parseInt(action.options.layer, 10) || 10);
        try {
          await instance.bridge.api.countdownControl("pause", {
            channel,
            layer,
          });
        } catch (e) {
          instance.log("error", `Countdown pause: ${e.message || e}`);
        }
      },
    },

    countdown_reset: {
      name: "Countdown: Reset",
      options: [
        {
          type: "number",
          id: "channel",
          label: "CasparCG channel",
          default: 1,
          min: 1,
          max: 8,
        },
        {
          type: "number",
          id: "layer",
          label: "Logical layer number",
          default: 10,
          min: 0,
          max: 9999,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const channel = Math.max(1, parseInt(action.options.channel, 10) || 1);
        const layer = Math.max(0, parseInt(action.options.layer, 10) || 10);
        try {
          await instance.bridge.api.countdownControl("reset", {
            channel,
            layer,
          });
        } catch (e) {
          instance.log("error", `Countdown reset: ${e.message || e}`);
        }
      },
    },

    countdown_set: {
      name: "Countdown: Set configuration",
      options: [
        {
          type: "number",
          id: "channel",
          label: "CasparCG channel",
          default: 1,
          min: 1,
          max: 8,
        },
        {
          type: "number",
          id: "layer",
          label: "Logical layer number",
          default: 10,
          min: 0,
          max: 9999,
        },
        {
          type: "textinput",
          id: "duration_ms",
          label: "Duration (ms, optional)",
          default: "",
        },
        {
          type: "textinput",
          id: "title",
          label: "Title (optional)",
          default: "",
        },
        {
          type: "textinput",
          id: "subtitle",
          label: "Subtitle (optional)",
          default: "",
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const channel = Math.max(1, parseInt(action.options.channel, 10) || 1);
        const layer = Math.max(0, parseInt(action.options.layer, 10) || 10);
        const opts = {
          channel,
          layer,
        };
        const durationMs = String(action.options.duration_ms || "").trim();
        if (durationMs) {
          const ms = parseInt(durationMs, 10);
          if (!Number.isNaN(ms) && ms > 0) opts.durationMs = ms;
        }
        const title = String(action.options.title || "").trim();
        if (title) opts.title = title;
        const subtitle = String(action.options.subtitle || "").trim();
        if (subtitle) opts.subtitle = subtitle;
        try {
          await instance.bridge.api.countdownControl("set", opts);
        } catch (e) {
          instance.log("error", `Countdown set: ${e.message || e}`);
        }
      },
    },
  };
}
