/**
 * @file look-presets.js
 * HighAsCG look presets (`scenes.lookPresets`, WO-601 / WO-781): a named set of screen → look
 * destinations, recalled on every screen at once by POST /api/scene/look-preset/recall. The list
 * comes from the live deck (`scene.deck`, newest) and the saved project (GET /api/project,
 * `project_sync`). Recall modes match the HighAsCG preset cards:
 *  - `preview` — the card click: load every destination to PRV;
 *  - `program` — "Cut to PGM";
 *  - `auto`    — load to PRV first, then ▶ (take to PGM with each look's own transition, or the
 *                deck default transition when asked).
 */

import { combineRgb } from "@companion-module/base";

export const LOOK_PRESET_MODES = [
  { id: "preview", label: "Recall to PRV" },
  { id: "program", label: "Recall to PGM (cut)" },
  { id: "auto", label: "Recall to PGM with auto take (PRV, then transition)" },
];

/**
 * @param {unknown} list — `lookPresets` from the deck or project
 * @returns {{ id: string, name: string, items: { mainIdx: number, sceneId: string, empty: boolean }[] }[]}
 */
export function normalizeLookPresets(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const p of list) {
    if (!p || typeof p !== "object" || p.id == null) continue;
    const id = String(p.id).trim();
    if (!id) continue;
    const items = [];
    const raw = Array.isArray(p.items)
      ? p.items
      : p.sceneId // a legacy single-look preset
        ? [{ mainIdx: p.targetMain, sceneId: p.sceneId }]
        : [];
    for (const it of raw) {
      if (!it || typeof it !== "object") continue;
      const mainIdx = Math.max(0, parseInt(it.mainIdx, 10) || 0);
      const sceneId = it.sceneId != null ? String(it.sceneId).trim() : "";
      items.push({ mainIdx, sceneId, empty: it.empty === true || !sceneId });
    }
    out.push({ id, name: String(p.name || "Preset").slice(0, 120), items });
  }
  return out;
}

/**
 * Store the preset list; rebuild the dropdowns and preset buttons when it changed.
 * @param {import('./instance.js').HighAsCGInstance} instance
 * @param {unknown} list
 */
export function ingestLookPresets(instance, list) {
  if (!Array.isArray(list)) return;
  const next = normalizeLookPresets(list);
  const sig = JSON.stringify(next);
  if (sig === instance._lookPresetsSig) return;
  instance._lookPresetsSig = sig;
  instance._lookPresets = next;
  instance.updateActions?.();
  instance.updatePresets?.();
  instance.checkFeedbacks?.("look_preset_on_pgm", "look_preset_on_prv");
}

/** @param {import('./instance.js').HighAsCGInstance} instance */
export function buildLookPresetDropdown(instance) {
  const list = Array.isArray(instance?._lookPresets)
    ? instance._lookPresets
    : [];
  if (list.length === 0) {
    return {
      choices: [{ id: "", label: "(No look presets — save one in HighAsCG)" }],
      default: "",
    };
  }
  return {
    choices: list.map((p) => ({
      id: p.id,
      label: `${p.name.slice(0, 56)} (${p.id.slice(0, 8)})`,
    })),
    default: list[0].id,
    minChoicesForSearch: 8,
  };
}

/** `screen 2: <error>` for each destination the server reports as failed. */
function itemErrors(res) {
  const items = Array.isArray(res?.items) ? res.items : [];
  return items
    .filter((it) => it && it.error)
    .map((it) => `screen ${(parseInt(it.mainIdx, 10) || 0) + 1}: ${it.error}`);
}

/**
 * @param {import('./instance.js').HighAsCGInstance} instance
 * @param {string} id
 * @param {'preview' | 'program' | 'auto'} mode
 * @param {{ globalTransition?: boolean }} [opts] — auto: the deck default transition instead of each look's own
 * @returns {Promise<string[]>} per-screen errors (empty = every destination recalled)
 */
export async function recallLookPreset(instance, id, mode, opts = {}) {
  const api = instance.bridge.api;
  if (mode === "preview") {
    return itemErrors(await api.recallLookPreset({ id, target: "preview" }));
  }
  if (mode === "program") {
    return itemErrors(
      await api.recallLookPreset({ id, target: "program", forceCut: true }),
    );
  }
  const prv = itemErrors(await api.recallLookPreset({ id, target: "preview" }));
  const pgm = itemErrors(
    await api.recallLookPreset({
      id,
      target: "program",
      forceCut: false,
      useGlobalTransition: !!opts.globalTransition,
    }),
  );
  return [...prv.map((e) => `PRV ${e}`), ...pgm.map((e) => `PGM ${e}`)];
}

/**
 * Every destination of the preset holds its look on the bus (an empty destination: nothing live).
 * @param {import('./instance.js').HighAsCGInstance} instance
 * @param {string} id
 * @param {'programChannels' | 'previewChannels'} bus
 */
export function lookPresetOnBus(instance, id, bus) {
  const p = (instance._lookPresets || []).find((x) => x.id === id);
  if (!p || p.items.length === 0) return false;
  for (const it of p.items) {
    const ch = instance._channelMap?.[bus]?.[it.mainIdx];
    if (ch == null || Number(ch) <= 0) return false;
    const entry = instance._sceneLive?.[String(ch)];
    const sid = entry?.sceneId != null ? String(entry.sceneId).trim() : "";
    if (it.empty ? sid !== "" : sid !== it.sceneId) return false;
  }
  return true;
}

/** @param {import('./instance.js').HighAsCGInstance} instance */
export function getLookPresetFeedbacks(instance) {
  const presetOption = () => ({
    type: "dropdown",
    id: "preset_id",
    label: "Look preset",
    allowCustom: true,
    ...buildLookPresetDropdown(instance),
  });
  return {
    look_preset_on_pgm: {
      type: "boolean",
      name: "Look preset is on program (PGM)",
      description:
        "True while every screen of the preset shows its look on PGM (an empty destination: nothing).",
      defaultStyle: {
        bgcolor: combineRgb(200, 0, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [presetOption()],
      callback: (fb) =>
        lookPresetOnBus(
          instance,
          String(fb.options.preset_id ?? "").trim(),
          "programChannels",
        ),
    },
    look_preset_on_prv: {
      type: "boolean",
      name: "Look preset is on preview (PRV)",
      description:
        "True while every screen of the preset shows its look on PRV (an empty destination: nothing).",
      defaultStyle: {
        bgcolor: combineRgb(0, 180, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [presetOption()],
      callback: (fb) =>
        lookPresetOnBus(
          instance,
          String(fb.options.preset_id ?? "").trim(),
          "previewChannels",
        ),
    },
  };
}
