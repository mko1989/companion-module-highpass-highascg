/**
 * @file timeline-actions.js
 * Timeline transport actions.
 */

import { defaultSendTo } from "./action-options.js";

export default function (instance) {
  return {
    timeline_play: {
      name: "Timeline: Play",
      options: [
        { type: "textinput", id: "id", label: "Timeline id", default: "" },
        {
          type: "textinput",
          id: "from_ms",
          label: "From (ms), blank = engine default",
          default: "",
        },
        {
          type: "number",
          id: "screen_index",
          label: "Screen index (sendTo)",
          default: 0,
          min: 0,
          max: 7,
        },
        {
          type: "checkbox",
          id: "tl_preview",
          label: "Send to preview",
          default: true,
        },
        {
          type: "checkbox",
          id: "tl_program",
          label: "Send to program",
          default: true,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const id = (action.options.id || "").trim();
        if (!id) return;
        const fromRaw = action.options.from_ms;
        const from =
          fromRaw === "" || fromRaw === null || fromRaw === undefined
            ? undefined
            : Number(fromRaw);
        try {
          await instance.bridge.api.timelinePlay(id, {
            ...(from != null && !Number.isNaN(from) ? { from } : {}),
            sendTo: defaultSendTo(action),
          });
        } catch (e) {
          instance.log("error", `Timeline play: ${e.message || e}`);
        }
      },
    },

    timeline_pause: {
      name: "Timeline: Pause",
      options: [
        { type: "textinput", id: "id", label: "Timeline id", default: "" },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const id = (action.options.id || "").trim();
        if (!id) return;
        try {
          await instance.bridge.api.timelinePause(id);
        } catch (e) {
          instance.log("error", `Timeline pause: ${e.message || e}`);
        }
      },
    },

    timeline_stop: {
      name: "Timeline: Stop",
      options: [
        { type: "textinput", id: "id", label: "Timeline id", default: "" },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const id = (action.options.id || "").trim();
        if (!id) return;
        try {
          await instance.bridge.api.timelineStop(id);
        } catch (e) {
          instance.log("error", `Timeline stop: ${e.message || e}`);
        }
      },
    },

    timeline_seek: {
      name: "Timeline: Seek",
      options: [
        { type: "textinput", id: "id", label: "Timeline id", default: "" },
        {
          type: "number",
          id: "ms",
          label: "Position (ms)",
          default: 0,
          min: 0,
          max: 999999999,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const id = (action.options.id || "").trim();
        if (!id) return;
        const ms = Math.max(0, parseInt(action.options.ms, 10) || 0);
        try {
          await instance.bridge.api.timelineSeek(id, ms);
        } catch (e) {
          instance.log("error", `Timeline seek: ${e.message || e}`);
        }
      },
    },

    timeline_loop: {
      name: "Timeline: Set loop",
      options: [
        { type: "textinput", id: "id", label: "Timeline id", default: "" },
        {
          type: "checkbox",
          id: "loop",
          label: "Loop",
          default: false,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const id = (action.options.id || "").trim();
        if (!id) return;
        try {
          await instance.bridge.api.timelineLoop(id, !!action.options.loop);
        } catch (e) {
          instance.log("error", `Timeline loop: ${e.message || e}`);
        }
      },
    },
  };
}
