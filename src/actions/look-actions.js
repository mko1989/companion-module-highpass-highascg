/**
 * @file look-actions.js
 * Look take, preview, slots, and PRV→PGM actions.
 */

import { buildLookDropdown } from "./look-choices.js";
import {
  takeFromPreviewForScreen,
  takeFromPreviewScreens,
} from "./preview-take.js";
import { executeLookTake, takeLookById } from "./look-take-core.js";

export default function (instance) {
  return {
    look_take: {
      name: "Take / cue look",
      options: (() => {
        const dd = buildLookDropdown(instance);
        return [
          {
            type: "dropdown",
            id: "look_id",
            label: "Look",
            choices: dd.choices,
            default: dd.default,
            allowCustom: true,
            minChoicesForSearch: dd.minChoicesForSearch ?? 8,
            tooltip:
              "Merged from live look deck (WebSocket) and saved project. Screen routing follows look mainScope when set.",
          },
          {
            type: "dropdown",
            id: "target",
            label: "Bus",
            default: "program",
            choices: [
              { id: "program", label: "Program (PGM take)" },
              { id: "preview", label: "Preview (PRV cue)" },
            ],
            // Desk buttons saved before this option existed have NO stored target; Companion 5's
            // option parser hard-fails a strict dropdown on a missing value ("Value is not in the
            // list of choices") BEFORE the callback runs. allowCustom lets those parse; the
            // callback already defaults anything non-"preview" to program.
            allowCustom: true,
          },
          {
            type: "number",
            id: "screen_index",
            label: "Screen index (when look scope is All)",
            default: 0,
            min: 0,
            max: 7,
            tooltip:
              "Used when the look mainScope is All. Scoped looks always route to their assigned screen destination.",
          },
          {
            type: "checkbox",
            id: "force_cut",
            label: "Force cut on PGM take (ignored for PRV cue)",
            default: false,
          },
        ];
      })(),
      callback: async (action) => {
        if (!instance.bridge?.api) {
          instance.log("warn", "Enable HighAsCG bridge and configure host/port.");
          return;
        }
        const raw = String(action.options.look_id ?? "").trim();
        if (!raw) {
          instance.log(
            "warn",
            "Choose a look (open the HighAsCG web UI so the look list can sync, or use a saved project as fallback).",
          );
          return;
        }
        const target =
          String(action.options.target ?? "program").toLowerCase() === "preview"
            ? "preview"
            : "program";
        try {
          await executeLookTake(instance, {
            lookId: raw,
            screenIndex: action.options.screen_index,
            forceCut: !!action.options.force_cut,
            target,
          });
        } catch (e) {
          instance.log(
            "error",
            `${target === "preview" ? "Cue look to preview" : "Take look"}: ${e.message || e}`,
          );
        }
      },
    },

    /** Backward compatibility — older presets/buttons used this action id. */
    look_preview: {
      name: "Cue look to preview",
      options: (() => {
        const dd = buildLookDropdown(instance);
        return [
          {
            type: "dropdown",
            id: "look_id",
            label: "Look",
            choices: dd.choices,
            default: dd.default,
            allowCustom: true,
            minChoicesForSearch: dd.minChoicesForSearch ?? 8,
          },
          {
            type: "number",
            id: "screen_index",
            label: "Screen index (when look scope is All)",
            default: 0,
            min: 0,
            max: 7,
          },
          {
            type: "checkbox",
            id: "force_cut",
            label: "Force cut (ignored — PRV cue always cuts)",
            default: false,
          },
        ];
      })(),
      callback: async (action) => {
        if (!instance.bridge?.api) {
          instance.log("warn", "Enable HighAsCG bridge and configure host/port.");
          return;
        }
        const raw = String(action.options.look_id ?? "").trim();
        if (!raw) {
          instance.log("warn", "Choose a look to cue on preview.");
          return;
        }
        try {
          await executeLookTake(instance, {
            lookId: raw,
            screenIndex: action.options.screen_index,
            forceCut: !!action.options.force_cut,
            target: "preview",
          });
        } catch (e) {
          instance.log("error", `Cue look to preview: ${e.message || e}`);
        }
      },
    },

    take_from_preview_all: {
      name: "Take all screens from preview (PRV → PGM)",
      options: [
        {
          type: "checkbox",
          id: "force_cut",
          label: "Force cut (no transition)",
          default: false,
        },
      ],
      callback: async (action) => {
        try {
          await takeFromPreviewScreens(
            instance,
            !!action.options.force_cut,
            null,
          );
        } catch (e) {
          instance.log("error", `Take all from preview: ${e.message || e}`);
        }
      },
    },

    take_from_preview: {
      name: "Take screen from preview (PRV → PGM)",
      options: [
        {
          type: "number",
          id: "screen_index",
          label: "Screen index (PGM/PRV routing)",
          default: 0,
          min: 0,
          max: 7,
        },
        {
          type: "checkbox",
          id: "force_cut",
          label: "Force cut (no transition)",
          default: false,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) {
          instance.log("warn", "Enable HighAsCG bridge and configure host/port.");
          return;
        }
        try {
          await takeFromPreviewForScreen(
            instance,
            action.options.screen_index,
            !!action.options.force_cut,
          );
        } catch (e) {
          instance.log("error", `Take from preview: ${e.message || e}`);
        }
      },
    },

    look_slot_take: {
      name: "Look Slot: Recall",
      options: [
        {
          type: "number",
          id: "slot",
          label: "Slot",
          default: 1,
          min: 1,
          max: 99,
        },
        {
          type: "number",
          id: "screen_index",
          label: "Screen index (PGM routing)",
          default: 0,
          min: 0,
          max: 7,
        },
        {
          type: "checkbox",
          id: "force_cut",
          label: "Force cut (no transition)",
          default: false,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const slot = Math.max(1, parseInt(action.options.slot, 10) || 1);
        const lookId = instance.getLookIdForSlot(slot);
        if (!lookId) {
          instance.log("warn", `Look slot ${slot} is empty.`);
          return;
        }
        try {
          await takeLookById(
            instance,
            lookId,
            action.options.screen_index,
            !!action.options.force_cut,
          );
        } catch (e) {
          instance.log("error", `Look slot recall: ${e.message || e}`);
        }
      },
    },

    look_refresh_list: {
      name: "Looks: Refresh list from HighAsCG",
      options: [],
      callback: async () => {
        if (!instance.bridge?.api) {
          instance.log("warn", "Enable HighAsCG bridge.");
          return;
        }
        try {
          await instance.refreshPresetLooks();
          instance.log(
            "info",
            `Look list refreshed (${instance._presetLooks.length} looks).`,
          );
        } catch (e) {
          instance.log("error", `Refresh looks: ${e.message || e}`);
        }
      },
    },

    look_slot_store_preview: {
      name: "Look Slot: Store from PRV",
      options: [
        {
          type: "number",
          id: "slot",
          label: "Slot",
          default: 1,
          min: 1,
          max: 99,
        },
      ],
      callback: async (action) => {
        const slot = Math.max(1, parseInt(action.options.slot, 10) || 1);
        const lookId = String(instance._previewLookId || "").trim();
        if (!lookId) {
          instance.log(
            "warn",
            "No preview look id in sync state. Open Looks deck in HighAsCG UI to sync preview selection.",
          );
          return;
        }
        if (!instance.setLookSlot(slot, lookId)) {
          instance.log("warn", "Could not store look slot.");
          return;
        }
        instance.log("info", `Stored look "${lookId}" to slot ${slot}.`);
      },
    },

    // WO-572 (HighAsCG) — stop whichever audio-only look is live on a screen's channel, leaving
    // that screen's normal video look completely untouched (mirrors the web UI mixer's Stop
    // button on an audio-only look's mixer row).
    look_audio_only_stop: {
      name: "Stop audio-only look",
      options: [
        {
          type: "number",
          id: "screen_index",
          label: "Screen index",
          default: 0,
          min: 0,
          max: 7,
        },
        {
          type: "dropdown",
          id: "bus",
          label: "Bus",
          default: "program",
          choices: [
            { id: "program", label: "Program (PGM)" },
            { id: "preview", label: "Preview (PRV)" },
          ],
          allowCustom: true,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const screenIdx = Math.max(
          0,
          parseInt(action.options.screen_index, 10) || 0,
        );
        const cm = instance._channelMap || {};
        const pgmCh = cm.programChannels?.[screenIdx];
        const channel =
          action.options.bus === "preview"
            ? cm.previewChannels?.[screenIdx]
            : pgmCh;
        if (channel == null || Number(channel) <= 0) {
          instance.log(
            "warn",
            `No ${action.options.bus === "preview" ? "PRV" : "PGM"} channel mapped for screen ${screenIdx + 1}.`,
          );
          return;
        }
        try {
          await instance.bridge.api.stopAudioOnlyLook(Number(channel));
        } catch (e) {
          instance.log("error", `Stop audio-only look: ${e.message || e}`);
        }
      },
    },
  };
}
