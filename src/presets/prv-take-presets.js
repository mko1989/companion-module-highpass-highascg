import { combineRgb } from "@companion-module/base";
import { getLookPreviewScreenLayouts } from "./look-preview-linked-presets.js";

/**
 * PRV → PGM take presets (global + per-screen).
 *
 * @param {Record<string, object>} presets
 * @param {Array<{ id: string, name: string, definitions: string[] }>} structure
 * @param {import('../instance.js').HighAsCGInstance} instance
 */
export function addPrvTakePresets(presets, structure, instance) {
  let section = structure.find((s) => s.id === "prv_pgm");
  if (!section) {
    section = {
      id: "prv_pgm",
      name: "HighAsCG · PRV → PGM",
      definitions: [],
    };
    structure.push(section);
  }

  presets.take_all_from_prv = {
    type: "simple",
    name: "TAKE ALL (PRV → PGM)",
    style: {
      text: "TAKE\\nALL",
      size: "18",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(180, 0, 0),
    },
    steps: [
      {
        down: [
          {
            actionId: "take_from_preview_all",
            options: { force_cut: false },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  };
  section.definitions.push("take_all_from_prv");

  presets.cut_all_from_prv = {
    type: "simple",
    name: "CUT ALL (PRV → PGM)",
    style: {
      text: "CUT\\nALL",
      size: "18",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(120, 0, 0),
    },
    steps: [
      {
        down: [
          {
            actionId: "take_from_preview_all",
            options: { force_cut: true },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  };
  section.definitions.push("cut_all_from_prv");

  const layouts = getLookPreviewScreenLayouts(instance);
  for (const layout of layouts) {
    if (layout.prvCh == null) continue;
    const takeKey = `take_prv_s${layout.screenIndex + 1}`;
    presets[takeKey] = {
      type: "simple",
      name: `TAKE ${layout.label}`,
      style: {
        text: `TAKE\\nScr ${layout.screenIndex + 1}`,
        size: "16",
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(0, 90, 0),
      },
      steps: [
        {
          down: [
            {
              actionId: "take_from_preview",
              options: {
                screen_index: layout.screenIndex,
                force_cut: false,
              },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    };
    section.definitions.push(takeKey);

    const cutKey = `cut_prv_s${layout.screenIndex + 1}`;
    presets[cutKey] = {
      type: "simple",
      name: `CUT ${layout.label}`,
      style: {
        text: `CUT\\nScr ${layout.screenIndex + 1}`,
        size: "16",
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(0, 60, 0),
      },
      steps: [
        {
          down: [
            {
              actionId: "take_from_preview",
              options: {
                screen_index: layout.screenIndex,
                force_cut: true,
              },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    };
    section.definitions.push(cutKey);
  }
}
