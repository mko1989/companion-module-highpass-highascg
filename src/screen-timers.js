/**
 * @file screen-timers.js
 * Screen-timer (WO-210) model for Companion: stable ordering, local countdown math and the
 * variable set. Mirrors the HighAsCG client's `timer-control-panel-display.js` — the server
 * publishes `{ config, lastCmd, cmdAt, remainingSec }` and every surface computes the display
 * itself, so a ticking readout costs no extra traffic.
 */

/** Slots of index-based variables published regardless of how many timers exist. */
export const TIMER_VARIABLE_SLOTS = 8;

/**
 * Deterministic order so `highascg_timer_1_*` keeps meaning the same timer between polls:
 * by lowest assigned screen, then that screen's CG layer, then timerId.
 * @param {object[]} timers — GET /api/timers/list `timers`
 * @returns {object[]}
 */
export function sortTimers(timers) {
  const key = (t) => {
    const entries = Object.entries(t?.screens || {});
    if (!entries.length)
      return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    let screen = Number.MAX_SAFE_INTEGER;
    let layer = Number.MAX_SAFE_INTEGER;
    for (const [idx, entry] of entries) {
      const s = parseInt(idx, 10);
      if (!Number.isFinite(s) || s > screen) continue;
      if (s < screen) {
        screen = s;
        layer = Number.isFinite(entry?.layer)
          ? entry.layer
          : Number.MAX_SAFE_INTEGER;
      } else if (Number.isFinite(entry?.layer) && entry.layer < layer) {
        layer = entry.layer;
      }
    }
    return [screen, layer];
  };
  return [...(Array.isArray(timers) ? timers : [])].sort((a, b) => {
    const [as, al] = key(a);
    const [bs, bl] = key(b);
    if (as !== bs) return as - bs;
    if (al !== bl) return al - bl;
    return String(a?.timerId || "").localeCompare(String(b?.timerId || ""));
  });
}

/**
 * Seconds a timer shows right now (may be negative once it runs past zero).
 * @param {object} timer
 * @param {number} [nowMs] — injectable for tests
 * @returns {number}
 */
export function computeDisplaySeconds(timer, nowMs = Date.now()) {
  if (!timer) return 0;
  const { config = {}, lastCmd, cmdAt, durationSec, remainingSec } = timer;
  const mode = config.mode || "duration";

  if (mode === "clock") {
    const [h, m, s] = String(config.targetTime || "00:00:00")
      .split(":")
      .map((x) => parseInt(x, 10) || 0);
    const now = new Date(nowMs);
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      h,
      m,
      s,
    );
    return (target.getTime() - nowMs) / 1000;
  }

  if (lastCmd === "pause") {
    return Number.isFinite(remainingSec)
      ? remainingSec
      : durationSec || config.durationSec || 0;
  }
  if (lastCmd === "start" && Number.isFinite(cmdAt)) {
    const basis = Number.isFinite(remainingSec)
      ? remainingSec
      : durationSec || config.durationSec || 0;
    return basis - (nowMs - cmdAt) / 1000;
  }
  return durationSec || config.durationSec || 0;
}

/**
 * `HH:MM:SS`, negative-aware (a timer past zero shows `-00:00:07`).
 * @param {number} seconds
 */
export function formatTimerClock(seconds) {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(seconds));
  const pad = (n) => String(n).padStart(2, "0");
  return `${sign}${pad(Math.floor(abs / 3600))}:${pad(Math.floor((abs % 3600) / 60))}:${pad(abs % 60)}`;
}

/** `MM:SS` when under an hour, else `HH:MM:SS` — the compact form for a button. */
export function formatTimerShort(seconds) {
  const abs = Math.abs(Math.trunc(seconds));
  if (abs >= 3600) return formatTimerClock(seconds);
  const sign = seconds < 0 ? "-" : "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * Parse a time typed into an action option: `90`, `5:00`, `01:30:00` (also accepts a bare
 * number of seconds). Minutes/seconds are NOT clamped to 59 — `90:00` is 90 minutes.
 * @param {string|number} text
 * @returns {number|null} seconds, or null when unparseable
 */
export function parseTimeText(text) {
  const raw = String(text ?? "").trim();
  if (!raw || !/^\d{1,4}(:\d{1,2}){0,2}$/.test(raw)) return null;
  const parts = raw.split(":").map((p) => parseInt(p, 10) || 0);
  const [h, m, s] =
    parts.length === 3
      ? parts
      : parts.length === 2
        ? [0, parts[0], parts[1]]
        : [0, 0, parts[0]];
  const total = h * 3600 + m * 60 + s;
  return Number.isFinite(total) && total >= 0 ? total : null;
}

/** Seconds → `HH:MM:SS`, the shape the countdown template's `targetTime` expects. */
export function secondsToClockText(totalSeconds) {
  const n = Math.max(0, Math.floor(totalSeconds || 0)) % 86400;
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(Math.floor(n / 3600))}:${pad(Math.floor((n % 3600) / 60))}:${pad(n % 60)}`;
}

/** running | paused | ready — what the transport last did. */
export function timerRunState(timer) {
  if (timer?.lastCmd === "start") return "running";
  if (timer?.lastCmd === "pause") return "paused";
  return "ready";
}

/** True when the timer is visible on ANY assigned screen. */
export function timerIsVisible(timer) {
  return Object.values(timer?.screens || {}).some((e) => !!e?.visible);
}

/** Screens a timer is assigned to, 1-based for display ("1, 2"). */
export function timerScreenLabel(timer) {
  return Object.keys(timer?.screens || {})
    .map((k) => parseInt(k, 10) + 1)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .join(", ");
}

/**
 * Variable definitions: `highascg_timer_count` plus a fixed block per slot, so button
 * expressions can be written before a timer exists.
 * @returns {{ variableId: string, name: string }[]}
 */
export function screenTimerVariableDefinitions() {
  const defs = [
    {
      variableId: "highascg_timer_count",
      name: "Screen timers: number of timers",
    },
  ];
  for (let i = 1; i <= TIMER_VARIABLE_SLOTS; i++) {
    defs.push(
      { variableId: `highascg_timer_${i}_name`, name: `Timer ${i}: name` },
      {
        variableId: `highascg_timer_${i}_time`,
        name: `Timer ${i}: display time (hh:mm:ss)`,
      },
      {
        variableId: `highascg_timer_${i}_time_short`,
        name: `Timer ${i}: display time (mm:ss under an hour)`,
      },
      {
        variableId: `highascg_timer_${i}_seconds`,
        name: `Timer ${i}: remaining whole seconds (negative past zero)`,
      },
      {
        variableId: `highascg_timer_${i}_state`,
        name: `Timer ${i}: run state (running/paused/ready)`,
      },
      {
        variableId: `highascg_timer_${i}_visible`,
        name: `Timer ${i}: on air (true/false)`,
      },
      {
        variableId: `highascg_timer_${i}_mode`,
        name: `Timer ${i}: mode (duration/clock)`,
      },
      {
        variableId: `highascg_timer_${i}_duration`,
        name: `Timer ${i}: configured duration (hh:mm:ss)`,
      },
      {
        variableId: `highascg_timer_${i}_screens`,
        name: `Timer ${i}: screens it is on (1-based)`,
      },
      { variableId: `highascg_timer_${i}_id`, name: `Timer ${i}: timer id` },
    );
  }
  return defs;
}

/**
 * Variable values for a polled timer list.
 * @param {object[]} timers — already sorted, or raw (sorted here)
 * @param {number} [nowMs]
 * @returns {Record<string, string|number>}
 */
export function screenTimerVariableValues(timers, nowMs = Date.now()) {
  const sorted = sortTimers(timers);
  /** @type {Record<string, string|number>} */
  const vars = { highascg_timer_count: sorted.length };
  for (let i = 1; i <= TIMER_VARIABLE_SLOTS; i++) {
    const t = sorted[i - 1];
    if (!t) {
      vars[`highascg_timer_${i}_name`] = "";
      vars[`highascg_timer_${i}_time`] = "";
      vars[`highascg_timer_${i}_time_short`] = "";
      vars[`highascg_timer_${i}_seconds`] = "";
      vars[`highascg_timer_${i}_state`] = "";
      vars[`highascg_timer_${i}_visible`] = "";
      vars[`highascg_timer_${i}_mode`] = "";
      vars[`highascg_timer_${i}_duration`] = "";
      vars[`highascg_timer_${i}_screens`] = "";
      vars[`highascg_timer_${i}_id`] = "";
      continue;
    }
    const secs = computeDisplaySeconds(t, nowMs);
    vars[`highascg_timer_${i}_name`] = t.name || `Timer ${i}`;
    vars[`highascg_timer_${i}_time`] = formatTimerClock(secs);
    vars[`highascg_timer_${i}_time_short`] = formatTimerShort(secs);
    vars[`highascg_timer_${i}_seconds`] = Math.trunc(secs);
    vars[`highascg_timer_${i}_state`] = timerRunState(t);
    vars[`highascg_timer_${i}_visible`] = timerIsVisible(t) ? "true" : "false";
    vars[`highascg_timer_${i}_mode`] = t.config?.mode || "duration";
    vars[`highascg_timer_${i}_duration`] =
      (t.config?.mode || "duration") === "clock"
        ? t.config?.targetTime || ""
        : formatTimerClock(Number(t.config?.durationSec) || 0);
    vars[`highascg_timer_${i}_screens`] = timerScreenLabel(t);
    vars[`highascg_timer_${i}_id`] = t.timerId || "";
  }
  return vars;
}

/**
 * Dropdown choices for the timer-picking actions. `""` means "the first timer", so a button
 * keeps working when a show is rebuilt with new timer ids.
 * @param {{ _screenTimers?: object[] }} instance
 */
export function buildScreenTimerDropdown(instance) {
  const timers = sortTimers(instance?._screenTimers || []);
  const choices = [{ id: "", label: "First timer (slot 1)" }];
  timers.forEach((t, i) => {
    const screens = timerScreenLabel(t);
    choices.push({
      id: t.timerId,
      label: `${(t.name || `Timer ${i + 1}`).slice(0, 48)} — slot ${i + 1}${screens ? ` · screen ${screens}` : ""}`,
    });
  });
  return { choices, default: "", minChoicesForSearch: 8 };
}

/**
 * Resolve an action's timer option to a live record.
 * @param {{ _screenTimers?: object[] }} instance
 * @param {string} timerIdOption
 * @returns {object|null}
 */
export function resolveTimer(instance, timerIdOption) {
  const timers = sortTimers(instance?._screenTimers || []);
  const wanted = String(timerIdOption || "").trim();
  if (!wanted) return timers[0] || null;
  return timers.find((t) => t.timerId === wanted) || null;
}
