/**
 * @file screen-timers.js
 * Screen-timer (WO-210) model for Companion: stable ordering, local countdown math and the
 * variable set. Mirrors the HighAsCG client's `timer-control-panel-display.js` — the server
 * publishes `{ config, lastCmd, cmdAt, remainingSec }` and every surface computes the display
 * itself, so a ticking readout costs no extra traffic.
 */

/**
 * Per-timer variable id. Keyed by the timer's own id (short form, as the web UI shows it) so the
 * set of variables is exactly the set of timers that exist — no placeholders (owner 2026-07-29:
 * "in companion i see there are placeholder 8 timers ... no place holders. everything should be
 * dynamic"). Definitions are re-registered whenever the timer list changes.
 * @param {object|string} timerOrId
 * @param {string} field
 */
export function timerVariableId(timerOrId, field) {
  const raw = typeof timerOrId === "string" ? timerOrId : timerOrId?.timerId;
  const slug = String(raw ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toLowerCase();
  return `highascg_timer_${slug || "unknown"}_${field}`;
}

/** Fields published for every timer. */
export const TIMER_VARIABLE_FIELDS = [
  ["name", "name"],
  ["time", "display time (hh:mm:ss)"],
  ["time_short", "display time (mm:ss under an hour)"],
  ["seconds", "remaining whole seconds (negative past zero)"],
  ["state", "run state (running/paused/ready)"],
  ["visible", "on air (true/false)"],
  ["mode", "mode (duration/clock)"],
  ["duration", "configured duration (hh:mm:ss)"],
  ["screens", "screens it is on (1-based)"],
  ["id", "timer id"],
];

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
 *
 * `cmdAt` and `targetTime` are anchored to the HighAsCG *server's* clock — Companion may be
 * running on a different machine (e.g. a Raspberry Pi) with its own clock, possibly skewed from
 * the server's. Subtracting a local `Date.now()` straight from a server timestamp bakes that
 * skew into the displayed countdown. `clockOffsetMs` (server clock minus local clock, measured
 * once per poll from the server's own `serverNowMs` — see bridge/screen-timer-poller.js) converts
 * `nowMs` into the server's clock before any such subtraction, so only clock *drift* between polls
 * matters, not the two machines' absolute clocks agreeing.
 * @param {object} timer
 * @param {number} [nowMs] — this process's own clock; injectable for tests
 * @param {number} [clockOffsetMs] — server clock minus local clock, from the last poll
 * @returns {number}
 */
export function computeDisplaySeconds(
  timer,
  nowMs = Date.now(),
  clockOffsetMs = 0,
) {
  if (!timer) return 0;
  const { config = {}, lastCmd, cmdAt, durationSec, remainingSec } = timer;
  const mode = config.mode || "duration";
  const serverNowMs = nowMs + (Number(clockOffsetMs) || 0);

  if (mode === "clock") {
    const [h, m, s] = String(config.targetTime || "00:00:00")
      .split(":")
      .map((x) => parseInt(x, 10) || 0);
    const now = new Date(serverNowMs);
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      h,
      m,
      s,
    );
    return (target.getTime() - serverNowMs) / 1000;
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
    return basis - (serverNowMs - cmdAt) / 1000;
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
 * Variable definitions for the timers that exist right now — one block per timer, plus the count.
 * @param {object[]} timers — GET /api/timers/list `timers`
 * @returns {{ variableId: string, name: string }[]}
 */
export function screenTimerVariableDefinitions(timers = []) {
  const defs = [
    {
      variableId: "highascg_timer_count",
      name: "Screen timers: number of timers",
    },
  ];
  for (const t of sortTimers(timers)) {
    const label = String(t.name || t.timerId || "Timer").slice(0, 40);
    for (const [field, what] of TIMER_VARIABLE_FIELDS) {
      defs.push({
        variableId: timerVariableId(t, field),
        name: `Timer "${label}": ${what}`,
      });
    }
  }
  return defs;
}

/**
 * Variable values for a polled timer list — only for timers that exist.
 * @param {object[]} timers
 * @param {number} [nowMs]
 * @param {number} [clockOffsetMs] — server clock minus local clock; see computeDisplaySeconds
 * @returns {Record<string, string|number>}
 */
export function screenTimerVariableValues(
  timers,
  nowMs = Date.now(),
  clockOffsetMs = 0,
) {
  const sorted = sortTimers(timers);
  /** @type {Record<string, string|number>} */
  const vars = { highascg_timer_count: sorted.length };
  for (const t of sorted) {
    const secs = computeDisplaySeconds(t, nowMs, clockOffsetMs);
    const set = (field, value) => {
      vars[timerVariableId(t, field)] = value;
    };
    set("name", t.name || "Timer");
    set("time", formatTimerClock(secs));
    set("time_short", formatTimerShort(secs));
    set("seconds", Math.trunc(secs));
    set("state", timerRunState(t));
    set("visible", timerIsVisible(t) ? "true" : "false");
    set("mode", t.config?.mode || "duration");
    set(
      "duration",
      (t.config?.mode || "duration") === "clock"
        ? t.config?.targetTime || ""
        : formatTimerClock(Number(t.config?.durationSec) || 0),
    );
    set("screens", timerScreenLabel(t));
    set("id", t.timerId || "");
  }
  return vars;
}

/**
 * Dropdown choices: the first-timer default plus every timer that exists. No placeholder rows —
 * a show with two timers offers two.
 * @param {{ _screenTimers?: object[] }} instance
 */
export function buildScreenTimerDropdown(instance) {
  const timers = sortTimers(instance?._screenTimers || []);
  const choices = [{ id: "", label: "First timer" }];
  timers.forEach((t, i) => {
    const screens = timerScreenLabel(t);
    choices.push({
      id: t.timerId,
      label: `${(t.name || `Timer ${i + 1}`).slice(0, 48)}${screens ? ` · screen ${screens}` : ""}`,
    });
  });
  return { choices, default: "", minChoicesForSearch: 8 };
}

/**
 * Resolve an action's timer option to a live record: a timer id, or empty for the first timer.
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
