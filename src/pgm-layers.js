/**
 * @file pgm-layers.js
 * PGM layer readback (HighAsCG WO-803): each screen's main (PGM) layer — remaining time and a text progress bar on a
 * button. Display only: the feedback has no action and the presets carry no actions.
 *
 * Data: GET /api/screens/pgm-layer (polled by src/bridge/pgm-layer-poller.js) →
 *   { screens: [{ screen, label, channel, active, layer, clip, remainingSec, durationSec, progress, paused }] }
 * The server picks the main layer (topmost non-looped clip in the live bank); a screen with nothing timed on PGM
 * answers `active: false` and the button shows its cleared state.
 */

import { combineRgb } from "@companion-module/base";
import { buildScreenDropdown } from "./actions/ftb-actions.js";
import { screenDisplayLabel, SCREEN_LABEL_COUNT } from "./look-vars.js";

export const PGM_READBACK_FEEDBACK_ID = "pgm_layer_readback";

/** Segments of the text progress bar under the time. */
export const BAR_SEGMENTS = 8;

const WHITE = combineRgb(255, 255, 255);
const DIM = combineRgb(110, 110, 110);
const BG_LIVE = combineRgb(60, 0, 0);
const BG_PAUSED = combineRgb(90, 60, 0);
const BG_IDLE = combineRgb(20, 20, 24);

/**
 * Remaining time as m:ss below an hour (mm:ss from ten minutes), h:mm:ss above. Rounded UP, so a clip with 0.4 s
 * left still reads 0:01 and 0:00 means it has ended.
 * @param {number | null | undefined} sec
 * @returns {string} "--:--" when unknown
 */
export function formatRemaining(sec) {
  const n = Number(sec);
  if (sec == null || !Number.isFinite(n)) return "--:--";
  const total = Math.max(0, Math.ceil(n - 1e-6));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Filled units for a progress value (0..1, clamped) on a scale of `width` units. */
export function barPixels(progress, width = BAR_SEGMENTS) {
  const p = Number(progress);
  if (!Number.isFinite(p)) return 0;
  return Math.round(Math.max(0, Math.min(1, p)) * width);
}

/** The progress bar as text: filled and empty blocks (no image is drawn on the button). */
export function barText(filled, segments = BAR_SEGMENTS) {
  const n = Math.max(0, Math.min(segments, Math.round(filled)));
  return "▰".repeat(n) + "▱".repeat(segments - n);
}

/**
 * What a screen's button shows — also the poller's change signature (only a change here redraws a button).
 * @param {object | null | undefined} entry  one `screens[]` item from the server
 */
export function readbackView(entry) {
  if (!entry || !entry.active) {
    return { active: false, time: "--:--", filled: 0, paused: false };
  }
  return {
    active: true,
    time: formatRemaining(entry.remainingSec),
    filled: barPixels(entry.progress, BAR_SEGMENTS),
    paused: entry.paused === true,
  };
}

/**
 * The feedback result for a screen: text (name, time, text bar) + colours.
 * @param {object | null | undefined} entry
 * @param {string} label  screen display name
 */
export function readbackStyle(entry, label) {
  const v = readbackView(entry);
  if (!v.active) {
    return { text: `${label}\\n--:--`, color: DIM, bgcolor: BG_IDLE };
  }
  const bar = barText(v.filled);
  return {
    text: v.paused
      ? `${label}\\n${v.time} PAUSED\\n${bar}`
      : `${label}\\n${v.time}\\n${bar}`,
    color: WHITE,
    bgcolor: v.paused ? BG_PAUSED : BG_LIVE,
  };
}

/** @param {import('./instance.js').HighAsCGInstance} instance */
export function pgmEntryForScreen(instance, screenIdx) {
  const list = Array.isArray(instance?._pgmLayers) ? instance._pgmLayers : [];
  return list.find((e) => Number(e?.screen) === screenIdx) || null;
}

/** @param {import('./instance.js').HighAsCGInstance} instance */
export function getPgmLayerFeedbacks(instance) {
  return {
    [PGM_READBACK_FEEDBACK_ID]: {
      type: "advanced",
      name: "PGM readback: main layer remaining + progress",
      description:
        "Display only. Shows the screen's main PGM layer (topmost non-looped clip): screen name, remaining time and a text progress bar. Amber + PAUSED while paused; dim --:-- when nothing is timed on PGM.",
      affectedProperties: ["text", "color", "bgcolor"],
      options: [
        {
          type: "dropdown",
          id: "screen",
          label: "Screen",
          ...buildScreenDropdown(instance),
        },
      ],
      callback: (feedback) => {
        const i = Math.max(0, parseInt(feedback.options?.screen, 10) || 0);
        return readbackStyle(
          pgmEntryForScreen(instance, i),
          screenDisplayLabel(instance?._channelMap, i),
        );
      },
    },
  };
}

/** @param {number} screenIdx 0-based @param {"remaining"|"progress"|"clip"} field */
export function pgmVariableId(screenIdx, field) {
  return `highascg_pgm_${screenIdx + 1}_${field}`;
}

/** Per-screen text variables (first SCREEN_LABEL_COUNT screens, like the screen-label variables). */
export function pgmLayerVariableDefinitions() {
  const defs = [];
  for (let i = 0; i < SCREEN_LABEL_COUNT; i += 1) {
    defs.push(
      {
        variableId: pgmVariableId(i, "remaining"),
        name: `Screen ${i + 1}: PGM main layer remaining (mm:ss, --:-- = nothing timed)`,
      },
      {
        variableId: pgmVariableId(i, "progress"),
        name: `Screen ${i + 1}: PGM main layer progress % (0-100)`,
      },
      {
        variableId: pgmVariableId(i, "clip"),
        name: `Screen ${i + 1}: PGM main layer clip name`,
      },
    );
  }
  return defs;
}

/** @param {Array<object>} screens  server `screens[]` */
export function pgmLayerVariableValues(screens) {
  const list = Array.isArray(screens) ? screens : [];
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < SCREEN_LABEL_COUNT; i += 1) {
    const e = list.find((x) => Number(x?.screen) === i);
    const active = !!e?.active;
    out[pgmVariableId(i, "remaining")] = active
      ? formatRemaining(e.remainingSec)
      : "--:--";
    out[pgmVariableId(i, "progress")] = active
      ? String(barPixels(e.progress, 100))
      : "";
    out[pgmVariableId(i, "clip")] = active ? String(e.clip || "") : "";
  }
  return out;
}
