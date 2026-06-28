import { combineRgb } from "@companion-module/base";
import { addComposePreviewPresets } from "./presets/compose-preview-presets.js";
import { addLookPreviewLinkedPresets } from "./presets/look-preview-linked-presets.js";
import { addPrvTakePresets } from "./presets/prv-take-presets.js";
import { connectionVariableExpression, connectionLabel } from "./connection-expressions.js";
import { isComposePreviewButtonsEnabled } from "./compose-preview-channels.js";
import {
  mainScopeShortLabel,
  normalizeMainScope,
} from "./look-scope.js";

/**
 * @param {import('./instance.js').HighAsCGInstance} instance
 * @param {string} variableId
 */
function connectionVar(instance, variableId) {
  return connectionVariableExpression(instance, variableId);
}

/**
 * @file presets.js
 * Companion presets — looks refresh when the bridge loads project data from HighAsCG.
 */

function presetKeyFromLookId(id) {
  return (
    "look_" +
    String(id)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 96)
  );
}

export default function getPresets(instance) {
  const presets = {};
  const structure = [
    { id: "playout", name: "Playout", definitions: [] },
    { id: "looks", name: "HighAsCG · Looks", definitions: [] },
    { id: "look_slots", name: "HighAsCG · Look Slots (PTZ style)", definitions: [] },
    { id: "selected_layer", name: "HighAsCG · Selected layer", definitions: [] },
    { id: "timeline", name: "HighAsCG · Timeline", definitions: [] },
    { id: "compose_preview", name: "HighAsCG · Compose preview", definitions: [] },
    {
      id: "compose_preview_quadrants",
      name: "HighAsCG · Compose preview · Quadrants",
      definitions: [],
    },
  ];

  const section = (id) => {
    const s = structure.find((x) => x.id === id);
    if (!s) throw new Error(`Unknown preset section: ${id}`);
    return s;
  };

  const add = (sectionId, key, preset) => {
    presets[key] = preset;
    section(sectionId).definitions.push(key);
  };

  add("playout", "play_clip", {
    type: "simple",
    name: "Play Ch1 L10",
    style: {
      text: "PLAY\\nCH1 L10",
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(0, 100, 0),
    },
    steps: [
      {
        down: [
          {
            actionId: "play",
            options: { channel: 1, layer: 10, clip: "", loop: false },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  });

  const looks = Array.isArray(instance._presetLooks) ? instance._presetLooks : [];
  const usedKeys = new Set();
  looks.forEach((look) => {
    let base = presetKeyFromLookId(look.id);
    let key = base;
    let n = 0;
    while (usedKeys.has(key)) {
      n += 1;
      key = `${base}_${n}`;
    }
    usedKeys.add(key);
    const scope = normalizeMainScope(look.mainScope);
    const screenIndex =
      scope === "all" ? 0 : Math.max(0, parseInt(scope, 10) || 0);
    const scopeTag = mainScopeShortLabel(look.mainScope);
    const display = (look.name || "Look").slice(0, 32);
    add("looks", key, {
      type: "simple",
      name: `${display} · ${scopeTag}`,
      style: {
        text: `${display}\\n${scopeTag}`,
        size: "14",
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(0, 0, 0),
      },
      steps: [
        {
          down: [
            {
              actionId: "look_take",
              options: {
                look_id: look.id,
                screen_index: screenIndex,
                force_cut: false,
              },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "look_on_pgm",
          options: {
            look_id: look.id,
            screen_index: screenIndex,
          },
          style: {
            bgcolor: combineRgb(200, 0, 0),
            color: combineRgb(255, 255, 255),
          },
        },
        {
          feedbackId: "look_on_prv_for_screen",
          options: {
            look_id: look.id,
            screen_index: screenIndex,
          },
          style: {
            bgcolor: combineRgb(0, 180, 0),
            color: combineRgb(255, 255, 255),
          },
        },
      ],
    });
  });

  const SLOT_COUNT = 20;
  for (let slot = 1; slot <= SLOT_COUNT; slot += 1) {
    const lookId = instance.getLookIdForSlot(slot);
    const look = looks.find((l) => String(l.id) === lookId) || null;
    const label = look ? (look.name || look.id).slice(0, 22) : "(empty)";
    add("look_slots", `look_slot_${slot}`, {
      type: "simple",
      name: `Slot ${slot}: ${label}`,
      style: {
        text: `L${slot}\\n${label}`,
        size: "14",
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(0, 0, 0),
      },
      steps: [
        {
          down: [],
          up: [
            {
              actionId: "look_slot_take",
              options: {
                slot,
                screen_index: 0,
                force_cut: false,
              },
            },
          ],
        },
        {
          down: [
            {
              actionId: "look_slot_store_preview",
              options: {
                slot,
              },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "look_slot_on_pgm",
          options: {
            slot,
            screen_index: 0,
          },
          style: {
            bgcolor: combineRgb(180, 0, 0),
            color: combineRgb(255, 255, 255),
          },
        },
        {
          feedbackId: "look_slot_on_prv",
          options: {
            slot,
          },
          style: {
            bgcolor: combineRgb(0, 150, 0),
            color: combineRgb(255, 255, 255),
          },
        },
      ],
    });
  }

  const selFillTransition = {
    duration: 1,
    tween: "",
    defer: false,
  };

  function presetSelLayerRelative(key, name, buttonText, deltas) {
    add("selected_layer", key, {
      type: "simple",
      name,
      style: {
        text: buttonText,
        size: "14",
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(45, 45, 72),
      },
      steps: [
        {
          down: [
            {
              actionId: "sel_layer_fill_relative",
              options: {
                stretch: false,
                speed_var: "500",
                ...selFillTransition,
                ...deltas,
              },
            },
          ],
          up: [
            {
              actionId: "sel_layer_fill_relative_stop",
              options: {},
            },
          ],
        },
      ],
      feedbacks: [
        {
          feedbackId: "ui_selection_layer_ready",
          options: {},
          style: {
            bgcolor: combineRgb(0, 110, 55),
            color: combineRgb(255, 255, 255),
          },
        },
      ],
    });
  }

  function presetSelLayerAbsolute(key, name, buttonText, fill) {
    add("selected_layer", key, {
      type: "simple",
      name,
      style: {
        text: buttonText,
        size: "14",
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(40, 55, 85),
      },
      steps: [
        {
          down: [
            {
              actionId: "sel_layer_fill",
              options: {
                stretch: false,
                ...selFillTransition,
                ...fill,
              },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "ui_selection_layer_ready",
          options: {},
          style: {
            bgcolor: combineRgb(0, 110, 55),
            color: combineRgb(255, 255, 255),
          },
        },
      ],
    });
  }

  add("selected_layer", "sel_ui_label_var", {
    type: "simple",
    name: "Selection (variables)",
    style: {
      text: {
        isExpression: true,
        value: `$(${connectionLabel(instance)}:highascg_ui_selection_label)\\n$(${connectionLabel(instance)}:highascg_ui_selection_context)`,
      },
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(38, 38, 58),
    },
    steps: [
      {
        down: [],
        up: [],
      },
    ],
    feedbacks: [
      {
        feedbackId: "ui_selection_layer_ready",
        options: {},
        style: {
          bgcolor: combineRgb(0, 110, 55),
          color: combineRgb(255, 255, 255),
        },
      },
    ],
  });

  presetSelLayerRelative("sel_nudge_left", "Move layer ◀", "◀\\nmove", {
    dx: -0.01,
  });
  presetSelLayerRelative("sel_nudge_right", "Move layer ▶", "▶\\nmove", {
    dx: 0.01,
  });
  presetSelLayerRelative("sel_nudge_up", "Move layer ▲", "▲\\nmove", {
    dy: -0.01,
  });
  presetSelLayerRelative("sel_nudge_down", "Move layer ▼", "▼\\nmove", {
    dy: 0.01,
  });
  presetSelLayerRelative("sel_scale_up", "Sel layer scale +", "Zoom\\n+", {
    dxScale: 0.05,
    dyScale: 0.05,
  });
  presetSelLayerRelative("sel_scale_down", "Sel layer scale −", "Zoom\\n−", {
    dxScale: -0.05,
    dyScale: -0.05,
  });

  presetSelLayerAbsolute("sel_fill_full", "Sel layer full frame", "FULL\\n1×", {
    x: 0,
    y: 0,
    xScale: 1,
    yScale: 1,
  });
  presetSelLayerAbsolute(
    "sel_fill_corner_tl",
    "Sel layer corner TL",
    "TL\\n½×",
    { x: 0, y: 0, xScale: 0.5, yScale: 0.5 },
  );
  presetSelLayerAbsolute(
    "sel_fill_corner_br",
    "Sel layer corner BR",
    "BR\\n½×",
    { x: 0.5, y: 0.5, xScale: 0.5, yScale: 0.5 },
  );

  add("looks", "look_take_manual", {
    type: "simple",
    name: "Take look (choose look)",
    style: {
      text: "Look",
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(90, 20, 20),
    },
    steps: [
      {
        down: [
          {
            actionId: "look_take",
            options: {
              look_id: "",
              screen_index: 0,
              force_cut: false,
            },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  });

  add("timeline", "tl_play_template", {
    type: "simple",
    name: "Play timeline (set id)",
    style: {
      text: "TL PLAY\\n(id in action)",
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(30, 80, 120),
    },
    steps: [
      {
        down: [
          {
            actionId: "timeline_play",
            options: {
              id: "",
              from_ms: "",
              screen_index: 0,
              tl_preview: true,
              tl_program: true,
            },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  });

  add("timeline", "tl_pause_template", {
    type: "simple",
    name: "Pause timeline (set id)",
    style: {
      text: "TL PAUSE",
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(40, 60, 90),
    },
    steps: [
      {
        down: [
          {
            actionId: "timeline_pause",
            options: { id: "" },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  });

  add("timeline", "tl_stop_template", {
    type: "simple",
    name: "Stop timeline (set id)",
    style: {
      text: "TL STOP",
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(50, 50, 70),
    },
    steps: [
      {
        down: [
          {
            actionId: "timeline_stop",
            options: { id: "" },
          },
        ],
        up: [],
      },
    ],
    feedbacks: [],
  });

  add("timeline", "tl_remaining_var", {
    type: "simple",
    name: "Remaining ms (variable)",
    style: {
      text: connectionVar(instance, "highascg_timeline_remaining"),
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(25, 45, 65),
    },
    steps: [
      {
        down: [],
        up: [],
      },
    ],
    feedbacks: [],
  });

  add("timeline", "tl_position_var", {
    type: "simple",
    name: "Position ms (variable)",
    style: {
      text: connectionVar(instance, "highascg_timeline_position"),
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(25, 45, 65),
    },
    steps: [
      {
        down: [],
        up: [],
      },
    ],
    feedbacks: [],
  });

  add("timeline", "tl_name_var", {
    type: "simple",
    name: "Active timeline name (variable)",
    style: {
      text: connectionVar(instance, "highascg_timeline_name"),
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(35, 55, 75),
    },
    steps: [
      {
        down: [],
        up: [],
      },
    ],
    feedbacks: [],
  });

  addComposePreviewPresets(presets, structure, instance);
  if (!isComposePreviewButtonsEnabled(instance?.config)) {
    for (let i = structure.length - 1; i >= 0; i -= 1) {
      const id = structure[i].id;
      if (id === "compose_preview" || id === "compose_preview_quadrants") {
        structure.splice(i, 1);
      }
    }
  }

  addLookPreviewLinkedPresets(presets, structure, instance);

  addPrvTakePresets(presets, structure, instance);

  add("timeline", "tl_duration_var", {
    type: "simple",
    name: "Duration ms (variable)",
    style: {
      text: connectionVar(instance, "highascg_timeline_duration"),
      size: "14",
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(35, 55, 75),
    },
    steps: [
      {
        down: [],
        up: [],
      },
    ],
    feedbacks: [],
  });

  return { structure, presets };
}
