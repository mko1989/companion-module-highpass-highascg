/**
 * @file screen-timer-actions.js
 * Full control of the HighAsCG screen timers (WO-210 registry, /api/timers/*) — the timers the
 * web UI shows in its Timers dock. Transport, set/adjust time, and show/hide with a fade.
 *
 * Timers are picked from a live dropdown; the empty choice means "the first timer", so a button
 * survives a show being rebuilt with new timer ids. Their readouts are published as variables
 * (see src/screen-timers.js).
 */

import {
  buildScreenTimerDropdown,
  parseTimeText,
  resolveTimer,
  secondsToClockText,
} from "../screen-timers.js";

/** Matches inspector-screen-timer.js / the Timers dock: a ~0.5s ramp at 50p. */
const DEFAULT_FADE_FRAMES = 25;

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {object} action
 * @returns {{ timer: object, api: object } | null}
 */
function target(instance, action) {
  const api = instance.bridge?.api;
  if (!api) return null;
  const timer = resolveTimer(instance, action.options?.timer);
  if (!timer) {
    instance.log(
      "warn",
      "Screen timer: no timer available (none assigned to a screen yet)",
    );
    return null;
  }
  return { timer, api };
}

/** Screen indices a timer is on, honouring the action's screen option ("" = all of them). */
function screenIndices(timer, option) {
  const all = Object.keys(timer?.screens || {})
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const wanted = String(option ?? "").trim();
  if (!wanted) return all;
  const idx = parseInt(wanted, 10);
  return all.includes(idx) ? [idx] : [];
}

export default function (instance) {
  const timerOption = () => ({
    type: "dropdown",
    id: "timer",
    label: "Timer",
    ...buildScreenTimerDropdown(instance),
  });

  const screenOption = () => ({
    type: "dropdown",
    id: "screen",
    label: "Screen",
    default: "",
    choices: [
      { id: "", label: "All screens the timer is on" },
      { id: "0", label: "Screen 1" },
      { id: "1", label: "Screen 2" },
      { id: "2", label: "Screen 3" },
      { id: "3", label: "Screen 4" },
    ],
  });

  /**
   * @param {object} action
   * @param {'start'|'pause'|'reset'} cmd
   */
  const transport = async (action, cmd) => {
    const t = target(instance, action);
    if (!t) return;
    try {
      // The server fans a cmd out to every screen the timer is on — one call is enough.
      await t.api.screenTimerCmd(t.timer.timerId, cmd);
      instance.refreshScreenTimers?.();
    } catch (e) {
      instance.log("error", `Screen timer ${cmd}: ${e.message || e}`);
    }
  };

  return {
    screen_timer_start: {
      name: "Screen timer: Start",
      options: [timerOption()],
      callback: async (action) => transport(action, "start"),
    },

    screen_timer_pause: {
      name: "Screen timer: Pause",
      options: [timerOption()],
      callback: async (action) => transport(action, "pause"),
    },

    screen_timer_reset: {
      name: "Screen timer: Reset",
      options: [timerOption()],
      callback: async (action) => transport(action, "reset"),
    },

    screen_timer_start_pause: {
      name: "Screen timer: Start / Pause (toggle)",
      options: [timerOption()],
      callback: async (action) => {
        const t = target(instance, action);
        if (!t) return;
        await transport(
          action,
          t.timer.lastCmd === "start" ? "pause" : "start",
        );
      },
    },

    screen_timer_set_time: {
      name: "Screen timer: Set time",
      description:
        "Duration timers: the countdown length. Clock timers: the target time of day. Accepts 90, 5:00 or 01:30:00.",
      options: [
        timerOption(),
        {
          type: "textinput",
          id: "time",
          label: "Time (ss, mm:ss or hh:mm:ss)",
          default: "05:00",
          useVariables: true,
        },
      ],
      callback: async (action) => {
        const t = target(instance, action);
        if (!t) return;
        // `time`'s `useVariables: true` already makes Companion resolve any $(...) reference
        // before the callback runs — @companion-module/base 2.1.0 removed
        // parseVariablesInString (from both the class and the callback context) as no longer
        // necessary for exactly this reason. Calling it here throws (WO-566).
        const raw = String(action.options?.time ?? "");
        const seconds = parseTimeText(raw);
        if (seconds == null) {
          instance.log("warn", `Screen timer set time: cannot parse "${raw}"`);
          return;
        }
        const isClock = (t.timer.config?.mode || "duration") === "clock";
        const patch = isClock
          ? { targetTime: secondsToClockText(seconds) }
          : { durationSec: seconds };
        const config = { ...(t.timer.config || {}), ...patch };
        try {
          // Every assigned screen needs its own CG UPDATE to redraw.
          for (const screenIdx of screenIndices(t.timer, "")) {
            await t.api.screenTimerAssign({
              timerId: t.timer.timerId,
              screenIdx,
              config,
            });
          }
          instance.refreshScreenTimers?.();
        } catch (e) {
          instance.log("error", `Screen timer set time: ${e.message || e}`);
        }
      },
    },

    screen_timer_adjust_time: {
      name: "Screen timer: Add / subtract time",
      description:
        "Changes the configured duration (use a negative value to subtract). Duration timers only.",
      options: [
        timerOption(),
        {
          type: "number",
          id: "delta",
          label: "Seconds (negative subtracts)",
          default: 60,
          min: -86400,
          max: 86400,
        },
      ],
      callback: async (action) => {
        const t = target(instance, action);
        if (!t) return;
        if ((t.timer.config?.mode || "duration") === "clock") {
          instance.log(
            "warn",
            "Screen timer adjust: not applicable to a clock-mode timer",
          );
          return;
        }
        const delta = parseInt(action.options?.delta, 10) || 0;
        const current = Number(t.timer.config?.durationSec) || 0;
        const config = {
          ...(t.timer.config || {}),
          durationSec: Math.max(0, current + delta),
        };
        try {
          for (const screenIdx of screenIndices(t.timer, "")) {
            await t.api.screenTimerAssign({
              timerId: t.timer.timerId,
              screenIdx,
              config,
            });
          }
          instance.refreshScreenTimers?.();
        } catch (e) {
          instance.log("error", `Screen timer adjust: ${e.message || e}`);
        }
      },
    },

    screen_timer_visible: {
      name: "Screen timer: Show / Hide",
      description:
        "Fades by default — set 0 frames for a hard cut. A fade-in lands on the timer's stored opacity.",
      options: [
        timerOption(),
        screenOption(),
        {
          type: "dropdown",
          id: "mode",
          label: "Action",
          default: "toggle",
          choices: [
            { id: "toggle", label: "Toggle" },
            { id: "show", label: "Show (fade in)" },
            { id: "hide", label: "Hide (fade out)" },
          ],
        },
        {
          type: "number",
          id: "fadeFrames",
          label: "Fade (frames, 0 = cut)",
          default: DEFAULT_FADE_FRAMES,
          min: 0,
          max: 500,
        },
      ],
      callback: async (action) => {
        const t = target(instance, action);
        if (!t) return;
        const screens = screenIndices(t.timer, action.options?.screen);
        if (!screens.length) {
          instance.log(
            "warn",
            "Screen timer show/hide: the timer is not on that screen",
          );
          return;
        }
        const fadeFrames = Math.max(
          0,
          Math.min(500, parseInt(action.options?.fadeFrames, 10) || 0),
        );
        const mode = String(action.options?.mode || "toggle");
        try {
          for (const screenIdx of screens) {
            const entry = t.timer.screens?.[String(screenIdx)];
            const visible =
              mode === "toggle" ? !entry?.visible : mode === "show";
            const body = { timerId: t.timer.timerId, screenIdx, visible };
            if (fadeFrames > 0) body.fadeFrames = fadeFrames;
            await t.api.screenTimerVisible(body);
          }
          instance.refreshScreenTimers?.();
        } catch (e) {
          instance.log("error", `Screen timer show/hide: ${e.message || e}`);
        }
      },
    },
  };
}
