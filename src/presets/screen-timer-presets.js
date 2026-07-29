/**
 * @file screen-timer-presets.js
 * Preset buttons for the HighAsCG screen timers (WO-384; actions and variables from WO-381).
 *
 * Every caption reads a variable, never a value baked in at build time — a preset's style is
 * copied onto the button when it is dragged out, so a literal would freeze there and stop
 * following the timer's name or its countdown.
 *
 * Two families:
 *  - "Timer N" buttons, bound to a slot (`highascg_timer_N_*`, ordered by screen then CG layer).
 *    They keep working when timers are recreated with new ids.
 *  - "Chosen timer" buttons, where the operator picks the timer in the action after dropping it.
 */

import { combineRgb } from "@companion-module/base";
import { connectionLabel } from "../connection-expressions.js";
import { TIMER_VARIABLE_SLOTS, timerSlotOptionId } from "../screen-timers.js";

/** How many per-slot button sets to publish. Keeping this below the variable count keeps the
 *  preset list readable — slots beyond it are still reachable via the "chosen timer" buttons. */
const PRESET_SLOTS = 4;

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

  // ---- Per-slot buttons -------------------------------------------------------------------
  for (
    let slot = 1;
    slot <= Math.min(PRESET_SLOTS, TIMER_VARIABLE_SLOTS);
    slot += 1
  ) {
    const slotOption = timerSlotOptionId(slot);
    const nameVar = `highascg_timer_${slot}_name`;
    const timeVar = `highascg_timer_${slot}_time_short`;
    const stateVar = `highascg_timer_${slot}_state`;

    // The readout: name over the live countdown, no action.
    add("screen_timers", `screen_timer_${slot}_display`, {
      type: "simple",
      name: `Timer ${slot}: display (name + countdown)`,
      style: {
        text: `${v(nameVar)}\\n${v(timeVar)}`,
        size: "18",
        color: WHITE,
        bgcolor: SLATE,
      },
      steps: [{ down: [], up: [] }],
      feedbacks: [],
    });

    // Start / pause on one button, with the countdown on it.
    add("screen_timers", `screen_timer_${slot}_start_pause`, {
      type: "simple",
      name: `Timer ${slot}: start / pause`,
      style: {
        text: `${v(timeVar)}\\n${v(stateVar)}`,
        size: "18",
        color: WHITE,
        bgcolor: GREEN,
      },
      steps: [
        {
          down: [
            {
              actionId: "screen_timer_start_pause",
              options: { timer: slotOption },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    });

    add("screen_timers", `screen_timer_${slot}_reset`, {
      type: "simple",
      name: `Timer ${slot}: reset`,
      style: {
        text: `RESET\\n${v(nameVar)}`,
        size: "14",
        color: WHITE,
        bgcolor: AMBER,
      },
      steps: [
        {
          down: [
            { actionId: "screen_timer_reset", options: { timer: slotOption } },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    });

    add("screen_timers", `screen_timer_${slot}_visible`, {
      type: "simple",
      name: `Timer ${slot}: show / hide (fade)`,
      style: {
        text: `ON AIR\\n${v(`highascg_timer_${slot}_visible`)}`,
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
                timer: slotOption,
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
  }

  // ---- Buttons that ask for the timer in the action editor --------------------------------
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
  for (const [key, name, caption, actionId, bgcolor] of chosen) {
    add("screen_timers", key, {
      type: "simple",
      name,
      style: { text: caption, size: "14", color: WHITE, bgcolor },
      steps: [{ down: [{ actionId, options: { timer: "" } }], up: [] }],
      feedbacks: [],
    });
  }

  add("screen_timers", "screen_timer_pick_set_time", {
    type: "simple",
    name: "Set time (choose timer + time)",
    style: { text: "SET\\n05:00", size: "14", color: WHITE, bgcolor: SLATE },
    steps: [
      {
        down: [
          {
            actionId: "screen_timer_set_time",
            options: { timer: "", time: "05:00" },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  });

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
