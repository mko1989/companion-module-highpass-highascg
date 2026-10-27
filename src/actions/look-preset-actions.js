/**
 * @file look-preset-actions.js
 * Look preset recall — the HighAsCG preset cards (POST /api/scene/look-preset/recall): PRV,
 * cut to PGM, or auto take (PRV first, then a transition to PGM, like the card's ▶).
 */

import {
  LOOK_PRESET_MODES,
  buildLookPresetDropdown,
  recallLookPreset,
} from "../look-presets.js";

export default function (instance) {
  const dd = buildLookPresetDropdown(instance);
  return {
    look_preset_recall: {
      name: "Look preset: Recall",
      description:
        "Recall a look preset saved in HighAsCG on every screen it covers at once.",
      options: [
        {
          type: "dropdown",
          id: "preset_id",
          label: "Look preset",
          choices: dd.choices,
          default: dd.default,
          allowCustom: true,
          minChoicesForSearch: dd.minChoicesForSearch ?? 8,
        },
        {
          type: "dropdown",
          id: "mode",
          label: "Recall",
          choices: LOOK_PRESET_MODES,
          default: "auto",
        },
        {
          type: "checkbox",
          id: "global_transition",
          label:
            "Auto take: use the deck default transition (off = each look's own)",
          default: false,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) {
          instance.log(
            "warn",
            "Enable HighAsCG bridge and configure host/port.",
          );
          return;
        }
        const id = String(action.options.preset_id ?? "").trim();
        if (!id) {
          instance.log("warn", "Choose a look preset.");
          return;
        }
        const m = String(action.options.mode ?? "auto");
        const mode = m === "preview" || m === "program" ? m : "auto";
        try {
          const errors = await recallLookPreset(instance, id, mode, {
            globalTransition: !!action.options.global_transition,
          });
          if (errors.length) {
            instance.log("warn", `Look preset recall: ${errors.join("; ")}`);
          }
        } catch (e) {
          instance.log("error", `Look preset recall: ${e.message || e}`);
        }
      },
    },
  };
}
