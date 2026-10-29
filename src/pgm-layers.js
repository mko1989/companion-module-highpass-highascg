/**
 * @file pgm-layers.js
 * PGM layer readback (HighAsCG WO-803): each screen's main (PGM) layer — remaining time and a progress bar on a
 * button. Display only: the feedback has no action and the presets carry no actions.
 *
 * Data: GET /api/screens/pgm-layer (polled by src/bridge/pgm-layer-poller.js) →
 *   { screens: [{ screen, label, channel, active, layer, clip, remainingSec, durationSec, progress, paused }] }
 * The server picks the main layer (topmost non-looped clip in the live bank); a screen with nothing timed on PGM
 * answers `active: false` and the button shows its cleared state.
 */

import { combineRgb } from "@companion-module/base";
import { PNG } from "pngjs";
import { buildScreenDropdown } from "./actions/ftb-actions.js";
import { screenDisplayLabel, SCREEN_LABEL_COUNT } from "./look-vars.js";

export const PGM_READBACK_FEEDBACK_ID = "pgm_layer_readback";

/** Button width the bar is drawn for when Companion does not tell us (standard 72 px button). */
export const BAR_WIDTH = 72;
export const BAR_HEIGHT = 8;

const WHITE = combineRgb(255, 255, 255);
const DIM = combineRgb(110, 110, 110);
const BG_LIVE = combineRgb(60, 0, 0);
const BG_PAUSED = combineRgb(90, 60, 0);
const BG_IDLE = combineRgb(20, 20, 24);

const FILL_RGB = [220, 0, 0];
const FILL_PAUSED_RGB = [230, 160, 0];
const TRACK_RGB = [70, 70, 70];

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

/** Filled bar pixels for a progress value (0..1, clamped). */
export function barPixels(progress, width = BAR_WIDTH) {
  const p = Number(progress);
  if (!Number.isFinite(p)) return 0;
  return Math.round(Math.max(0, Math.min(1, p)) * width);
}

/**
 * The progress bar as a PNG (raw base64, Companion's png64): grey track, filled part red (amber while paused).
 * @param {number} filled  pixels filled
 * @param {{ width?: number, height?: number, paused?: boolean }} [o]
 */
export function drawBarPng64(filled, o = {}) {
  const width = Math.max(1, Math.round(o.width || BAR_WIDTH));
  const height = Math.max(1, Math.round(o.height || BAR_HEIGHT));
  const png = new PNG({ width, height });
  const fill = o.paused ? FILL_PAUSED_RGB : FILL_RGB;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const c = x < filled ? fill : TRACK_RGB;
      png.data[i] = c[0];
      png.data[i + 1] = c[1];
      png.data[i + 2] = c[2];
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png).toString("base64");
}

/**
 * What a screen's button shows — also the poller's change signature (only a change here redraws a button).
 * @param {object | null | undefined} entry  one `screens[]` item from the server
 * @param {number} [width]
 */
export function readbackView(entry, width = BAR_WIDTH) {
  if (!entry || !entry.active) {
    return { active: false, time: "--:--", filled: 0, paused: false };
  }
  return {
    active: true,
    time: formatRemaining(entry.remainingSec),
    filled: barPixels(entry.progress, width),
    paused: entry.paused === true,
  };
}

/** Cache of drawn bars, so redraws of the same state do not re-encode a PNG. */
const barCache = new Map();
function cachedBar(filled, width, paused) {
  const key = `${width}:${filled}:${paused ? 1 : 0}`;
  let b = barCache.get(key);
  if (!b) {
    if (barCache.size > 1000) barCache.clear();
    b = drawBarPng64(filled, { width, paused });
    barCache.set(key, b);
  }
  return b;
}

/**
 * The feedback result for a screen (text + colours + the bar image along the bottom).
 * @param {object | null | undefined} entry
 * @param {string} label  screen display name
 * @param {number} [width]  button width in px (Companion's `feedback.image.width` when given)
 */
export function readbackStyle(entry, label, width = BAR_WIDTH) {
  const v = readbackView(entry, width);
  if (!v.active) {
    return { text: `${label}\\n--:--`, color: DIM, bgcolor: BG_IDLE };
  }
  return {
    text: v.paused ? `${label}\\n${v.time}\\nPAUSED` : `${label}\\n${v.time}`,
    color: WHITE,
    bgcolor: v.paused ? BG_PAUSED : BG_LIVE,
    png64: cachedBar(v.filled, width, v.paused),
    pngalignment: "center:bottom",
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
        "Display only. Shows the screen's main PGM layer (topmost non-looped clip): screen name, remaining time and a progress bar along the bottom. Amber + PAUSED while paused; dim --:-- when nothing is timed on PGM.",
      affectedProperties: ["text", "color", "bgcolor", "png64", "pngalignment"],
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
        const width =
          Number(feedback.image?.width) > 0
            ? Number(feedback.image.width)
            : BAR_WIDTH;
        return readbackStyle(
          pgmEntryForScreen(instance, i),
          screenDisplayLabel(instance?._channelMap, i),
          width,
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
