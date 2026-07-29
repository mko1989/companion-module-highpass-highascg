/**
 * @file screen-timer-presets.js
 * Preset buttons for the HighAsCG screen timers (WO-384, made fully dynamic by WO-386).
 *
 * One button set per timer that actually exists — no placeholder slots (owner 2026-07-29: "in
 * companion i see there are placeholder 8 timers. come one???!!! no place holders. everything
 * should be dynamic"). The poller re-runs the preset build whenever the set of timers changes.
 *
 * Captions read that timer's own variables, never a value baked in at build time: a preset's style
 * is copied onto the button when it is dragged out, so a literal would freeze there and stop
 * following the timer's name or its countdown.
 */

import { combineRgb } from "@companion-module/base";
import { connectionLabel } from "../connection-expressions.js";
import { sortTimers, timerVariableId } from "../screen-timers.js";

const WHITE = combineRgb(255, 255, 255);
const BLACK = combineRgb(0, 0, 0);
const GREEN = combineRgb(0, 120, 40);
const AMBER = combineRgb(140, 90, 0);
const RED = combineRgb(150, 0, 0);
const SLATE = combineRgb(30, 40, 55);

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {(sectionId: string, key: string, preset: object) => void} add
 */
export function addScreenTimerPresets(instance, add) {
  const v = (variableId) => `$(${connectionLabel(instance)}:${variableId})`;
  const timers = sortTimers(instance?._screenTimers || []);

  for (const timer of timers) {
    const id = timer.timerId;
    const key = String(id)
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8)
      .toLowerCase();
    const shown = String(timer.name || id).slice(0, 32);
    const nameVar = v(timerVariableId(timer, "name"));
    const timeVar = v(timerVariableId(timer, "time_short"));
    const stateVar = v(timerVariableId(timer, "state"));
    const visibleVar = v(timerVariableId(timer, "visible"));

    add("screen_timers", `screen_timer_${key}_display`, {
      type: "simple",
      name: `${shown}: display (name + countdown)`,
      style: {
        text: `${nameVar}\\n${timeVar}`,
        size: "18",
        color: WHITE,
        bgcolor: SLATE,
      },
      steps: [{ down: [], up: [] }],
      feedbacks: [],
    });

    add("screen_timers", `screen_timer_${key}_start_pause`, {
      type: "simple",
      name: `${shown}: start / pause`,
      style: {
        text: `${timeVar}\\n${stateVar}`,
        size: "18",
        color: WHITE,
        bgcolor: GREEN,
      },
      steps: [
        {
          down: [
            { actionId: "screen_timer_start_pause", options: { timer: id } },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    });

    add("screen_timers", `screen_timer_${key}_reset`, {
      type: "simple",
      name: `${shown}: reset`,
      style: {
        text: `RESET\\n${nameVar}`,
        size: "14",
        color: WHITE,
        bgcolor: AMBER,
      },
      steps: [
        {
          down: [{ actionId: "screen_timer_reset", options: { timer: id } }],
          up: [],
        },
      ],
      feedbacks: [],
    });

    add("screen_timers", `screen_timer_${key}_visible`, {
      type: "simple",
      name: `${shown}: show / hide (fade)`,
      style: {
        text: `ON AIR\\n${visibleVar}`,
        size: "14",
        color: WHITE,
        bgcolor: RED,
      },
      steps: [
        {
          down: [
            {
              actionId: "screen_timer_visible",
              options: {
                timer: id,
                screen: "",
                mode: "toggle",
                fadeFrames: 25,
              },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    });

    add("screen_timers", `screen_timer_${key}_set_time`, {
      type: "simple",
      name: `${shown}: set time`,
      style: {
        text: `SET\\n${nameVar}`,
        size: "14",
        color: WHITE,
        bgcolor: SLATE,
      },
      steps: [
        {
          down: [
            {
              actionId: "screen_timer_set_time",
              options: { timer: id, time: "05:00" },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    });
  }

  // Buttons that ask for the timer in the action editor — the only ones that exist when no timers
  // are configured, so a button can still be built ahead of the show.
  const chosen = [
    [
      "screen_timer_pick_start",
      "Start (choose timer)",
      "START",
      "screen_timer_start",
      GREEN,
    ],
    [
      "screen_timer_pick_pause",
      "Pause (choose timer)",
      "PAUSE",
      "screen_timer_pause",
      AMBER,
    ],
    [
      "screen_timer_pick_reset",
      "Reset (choose timer)",
      "RESET",
      "screen_timer_reset",
      BLACK,
    ],
  ];
  for (const [presetKey, name, caption, actionId, bgcolor] of chosen) {
    add("screen_timers", presetKey, {
      type: "simple",
      name,
      style: { text: caption, size: "14", color: WHITE, bgcolor },
      steps: [{ down: [{ actionId, options: { timer: "" } }], up: [] }],
      feedbacks: [],
    });
  }

  add("screen_timers", "screen_timer_pick_add_minute", {
    type: "simple",
    name: "Add a minute (choose timer)",
    style: { text: "+1:00", size: "18", color: WHITE, bgcolor: SLATE },
    steps: [
      {
        down: [
          {
            actionId: "screen_timer_adjust_time",
            options: { timer: "", delta: 60 },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  });

  add("screen_timers", "screen_timer_pick_sub_minute", {
    type: "simple",
    name: "Take off a minute (choose timer)",
    style: { text: "-1:00", size: "18", color: WHITE, bgcolor: SLATE },
    steps: [
      {
        down: [
          {
            actionId: "screen_timer_adjust_time",
            options: { timer: "", delta: -60 },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  });
}
