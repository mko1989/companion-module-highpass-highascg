/**
 * @file look-preset-presets.js
 * One row per HighAsCG look preset: PRV, PGM (cut) and AUTO (PRV, then transition to PGM).
 * Green while the preset is on PRV, red while it is on PGM.
 */

import { combineRgb } from "@companion-module/base";

const WHITE = combineRgb(255, 255, 255);
const BG = combineRgb(30, 30, 45);
const GREEN = combineRgb(0, 180, 0);
const RED = combineRgb(200, 0, 0);

const BUTTONS = [
  { mode: "preview", tag: "PRV" },
  { mode: "program", tag: "PGM" },
  { mode: "auto", tag: "AUTO" },
];

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {(sectionId: string, key: string, preset: object) => void} add
 */
export function addLookPresetPresets(instance, add) {
  const list = Array.isArray(instance?._lookPresets)
    ? instance._lookPresets
    : [];
  for (const p of list) {
    const key = String(p.id)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 64);
    for (const b of BUTTONS) {
      add("look_presets", `look_preset_${b.mode}_${key}`, {
        type: "simple",
        name: `${p.name} → ${b.tag}`,
        style: {
          text: `${p.name.slice(0, 24)}\\n${b.tag}`,
          size: "14",
          color: WHITE,
          bgcolor: BG,
        },
        steps: [
          {
            down: [
              {
                actionId: "look_preset_recall",
                options: {
                  preset_id: p.id,
                  mode: b.mode,
                  global_transition: false,
                },
              },
            ],
            up: [],
          },
        ],
        // PGM after PRV: a preset on both buses (after an auto take) shows red.
        feedbacks: [
          {
            feedbackId: "look_preset_on_prv",
            options: { preset_id: p.id },
            style: { bgcolor: GREEN, color: WHITE },
          },
          {
            feedbackId: "look_preset_on_pgm",
            options: { preset_id: p.id },
            style: { bgcolor: RED, color: WHITE },
          },
        ],
      });
    }
  }
}
