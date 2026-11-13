/**
 * @file timeline-actions.js
 * Timeline transport actions. Every action picks its timeline from a dropdown whose default is the
 * ACTIVE timeline (src/timelines.js), so a fresh button works without an id. Failures are logged
 * with the timeline name — before, an empty id returned silently and nothing ever happened.
 */

import { defaultSendTo } from "./action-options.js";
import {
  timelineOption,
  resolveTimelineId,
  playbackOf,
  timelineState,
  timelineName,
} from "../timelines.js";

const ROUTING_OPTIONS = [
  {
    type: "checkbox",
    id: "override_routing",
    label:
      "Override the timeline's routing (else it plays where HighAsCG sends it)",
    default: false,
  },
  {
    type: "number",
    id: "screen_index",
    label: "Screen index (override only, 0 = screen 1)",
    default: 0,
    min: 0,
    max: 7,
  },
  {
    type: "checkbox",
    id: "tl_preview",
    label: "Send to preview (override only)",
    default: false,
  },
  {
    type: "checkbox",
    id: "tl_program",
    label: "Send to program (override only)",
    default: true,
  },
];

function label(instance, id) {
  const t = timelineState(instance).list.find((x) => String(x.id) === id);
  return t ? `"${timelineName(t)}"` : id;
}

/**
 * Run one transport call for the resolved timeline; logs (never throws) so a press can't hang Companion.
 * @param {(api: object, id: string) => Promise<unknown>} fn
 */
async function run(instance, action, what, fn) {
  const api = instance.bridge?.api;
  if (!api) {
    instance.log("warn", `Timeline ${what}: not connected to HighAsCG`);
    return;
  }
  const id = resolveTimelineId(instance, action.options.id);
  if (!id) {
    instance.log("warn", `Timeline ${what}: this show has no timeline`);
    return;
  }
  try {
    await fn(api, id);
  } catch (e) {
    instance.log(
      "error",
      `Timeline ${what} ${label(instance, id)}: ${e.message || e}`,
    );
  }
}

function playBody(action, fromMs) {
  const body = {};
  if (fromMs != null && !Number.isNaN(fromMs)) body.from = fromMs;
  if (action.options.override_routing === true)
    body.sendTo = defaultSendTo(action);
  return body;
}

function parseFrom(raw) {
  if (raw === "" || raw === null || raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : Math.max(0, n);
}

export default function (instance) {
  const tl = () => timelineOption(instance);
  return {
    timeline_play: {
      name: "Timeline: Play",
      options: [
        tl(),
        {
          type: "textinput",
          id: "from_ms",
          label: "From (ms), blank = where it is",
          default: "",
        },
        ...ROUTING_OPTIONS,
      ],
      callback: (action) =>
        run(instance, action, "play", (api, id) =>
          api.timelinePlay(
            id,
            playBody(action, parseFrom(action.options.from_ms)),
          ),
        ),
    },

    timeline_toggle: {
      name: "Timeline: Play / Pause",
      description: "Plays the timeline, or pauses it when it is playing.",
      options: [tl(), ...ROUTING_OPTIONS],
      callback: (action) =>
        run(instance, action, "play/pause", (api, id) =>
          playbackOf(instance, id).playing
            ? api.timelinePause(id)
            : api.timelinePlay(id, playBody(action)),
        ),
    },

    timeline_pause: {
      name: "Timeline: Pause",
      options: [tl()],
      callback: (action) =>
        run(instance, action, "pause", (api, id) => api.timelinePause(id)),
    },

    timeline_stop: {
      name: "Timeline: Stop",
      options: [
        tl(),
        {
          type: "checkbox",
          id: "force",
          label: "Stop even when it is live on program",
          default: true,
          tooltip:
            "HighAsCG refuses to stop a timeline that is on program unless the stop is deliberate. A button press is.",
        },
      ],
      callback: (action) =>
        run(instance, action, "stop", (api, id) =>
          api.timelineStop(id, { force: action.options.force !== false }),
        ),
    },

    timeline_seek: {
      name: "Timeline: Seek",
      options: [
        tl(),
        {
          type: "number",
          id: "ms",
          label: "Position (ms)",
          default: 0,
          min: 0,
          max: 999999999,
        },
      ],
      callback: (action) =>
        run(instance, action, "seek", (api, id) =>
          api.timelineSeek(
            id,
            Math.max(0, parseInt(action.options.ms, 10) || 0),
          ),
        ),
    },

    timeline_nudge: {
      name: "Timeline: Jump back / forward",
      options: [
        tl(),
        {
          type: "number",
          id: "delta_ms",
          label: "Jump (ms, negative = back)",
          default: -5000,
          min: -3600000,
          max: 3600000,
        },
      ],
      callback: (action) =>
        run(instance, action, "jump", (api, id) => {
          const pos = playbackOf(instance, id).position;
          const delta = parseInt(action.options.delta_ms, 10) || 0;
          return api.timelineSeek(id, Math.max(0, Math.round(pos + delta)));
        }),
    },

    timeline_loop: {
      name: "Timeline: Set loop",
      options: [
        tl(),
        {
          type: "dropdown",
          id: "mode",
          label: "Loop",
          default: "toggle",
          choices: [
            { id: "toggle", label: "Toggle" },
            { id: "on", label: "On" },
            { id: "off", label: "Off" },
          ],
        },
      ],
      callback: (action) =>
        run(instance, action, "loop", (api, id) => {
          // pre-1.0.3 buttons stored a `loop` checkbox instead of `mode`
          const mode =
            action.options.mode ??
            (action.options.loop === true ? "on" : "off");
          const on =
            mode === "toggle" ? !playbackOf(instance, id).loop : mode === "on";
          return api.timelineLoop(id, on);
        }),
    },

    timeline_take: {
      name: "Timeline: Take (direct to out bus)",
      options: [
        tl(),
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
      callback: (action) =>
        run(instance, action, "take", (api, id) =>
          api.timelineTake(id, { sendTo: defaultSendTo(action) }),
        ),
    },

    timeline_sendto: {
      name: "Timeline: Set sendTo routing",
      options: [
        tl(),
        {
          type: "number",
          id: "screen_index",
          label: "Screen index",
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
      callback: (action) =>
        run(instance, action, "sendto", (api, id) =>
          api.timelineSendTo(id, defaultSendTo(action)),
        ),
    },
  };
}
