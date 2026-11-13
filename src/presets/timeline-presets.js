/**
 * @file timeline-presets.js
 * Timeline transport buttons that work as dropped: the ACTIVE timeline row (no id to fill in) and a
 * Play / Pause button per timeline of the show (rebuilt when the timeline list changes).
 */

import { combineRgb } from "@companion-module/base";
import { connectionLabel } from "../connection-expressions.js";
import { ACTIVE, timelineState, timelineName } from "../timelines.js";

const WHITE = combineRgb(255, 255, 255);
const GREEN = combineRgb(0, 150, 0);
const AMBER = combineRgb(190, 120, 0);
const BLUE = combineRgb(30, 70, 120);
const SLATE = combineRgb(40, 50, 70);
const DARK_RED = combineRgb(110, 20, 20);

function stateFeedbacks(id) {
  return [
    {
      feedbackId: "timeline_state",
      options: { id, state: "playing" },
      style: { bgcolor: GREEN, color: WHITE },
    },
    {
      feedbackId: "timeline_state",
      options: { id, state: "paused" },
      style: { bgcolor: AMBER, color: WHITE },
    },
  ];
}

function button(
  name,
  text,
  actions,
  feedbacks = [],
  bgcolor = SLATE,
  size = "14",
) {
  return {
    type: "simple",
    name,
    style: { text, size, color: WHITE, bgcolor },
    steps: [{ down: actions, up: [] }],
    feedbacks,
  };
}

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {(sectionId: string, key: string, preset: object) => void} add
 */
export function addTimelinePresets(instance, add) {
  const v = (id) => `$(${connectionLabel(instance)}:${id})`;
  const active = { id: ACTIVE };

  add(
    "timeline",
    "tl_toggle_active",
    button(
      "Play / Pause the active timeline",
      `⏯ ${v("highascg_timeline_name")}\\n${v("highascg_timeline_position")}`,
      [
        {
          actionId: "timeline_toggle",
          options: { ...active, override_routing: false },
        },
      ],
      stateFeedbacks(ACTIVE),
      BLUE,
      "auto",
    ),
  );
  add(
    "timeline",
    "tl_stop_active",
    button(
      "Stop the active timeline",
      "⏹ STOP",
      [{ actionId: "timeline_stop", options: { ...active, force: true } }],
      [],
      DARK_RED,
      "18",
    ),
  );
  add(
    "timeline",
    "tl_rewind_active",
    button("Active timeline back to the start", "⏮ START", [
      { actionId: "timeline_seek", options: { ...active, ms: 0 } },
    ]),
  );
  add(
    "timeline",
    "tl_back_active",
    button("Active timeline: back 5 s", "⏪ -5 s", [
      { actionId: "timeline_nudge", options: { ...active, delta_ms: -5000 } },
    ]),
  );
  add(
    "timeline",
    "tl_fwd_active",
    button("Active timeline: forward 5 s", "⏩ +5 s", [
      { actionId: "timeline_nudge", options: { ...active, delta_ms: 5000 } },
    ]),
  );
  add(
    "timeline",
    "tl_loop_active",
    button(
      "Loop on / off (active timeline)",
      "🔁 LOOP",
      [{ actionId: "timeline_loop", options: { ...active, mode: "toggle" } }],
      [
        {
          feedbackId: "timeline_loop_on",
          options: active,
          style: { bgcolor: AMBER, color: WHITE },
        },
      ],
    ),
  );

  for (const t of timelineState(instance).list) {
    const id = String(t.id);
    const key = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const name = timelineName(t);
    add(
      "timeline",
      `tl_toggle_${key}`,
      button(
        `Play / Pause: ${name}`,
        `⏯ ${name.slice(0, 24)}`,
        [
          {
            actionId: "timeline_toggle",
            options: { id, override_routing: false },
          },
        ],
        stateFeedbacks(id),
        BLUE,
        "auto",
      ),
    );
    add(
      "timeline",
      `tl_stop_${key}`,
      button(
        `Stop: ${name}`,
        `⏹ ${name.slice(0, 24)}`,
        [{ actionId: "timeline_stop", options: { id, force: true } }],
        [],
        DARK_RED,
        "auto",
      ),
    );
  }
}
