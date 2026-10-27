/**
 * @file playlist-presets.js
 * Preset buttons for HighAsCG playlists:
 *
 *  - "Playlists" section: Prev / current item / Next for Companion's SELECTED playlist, the
 *    previous / next playlist selectors, and one "select" button per playlist;
 *  - one section per playlist: its own Prev / current item / Next, plus a Go-to button per item.
 *
 * Captions read variables, never names baked in at build time — a preset's style is copied onto
 * the button when it is dragged out, so a literal would freeze there (same rule as the look and
 * timer presets). The current item's name is therefore always `$(…_item)`.
 */

import { combineRgb } from "@companion-module/base";
import { connectionLabel } from "../connection-expressions.js";
import {
  MAX_ITEM_SLOTS,
  playlistKey,
  playlistName,
  playlistSlug,
  playlistVariableId,
  selectedPlaylistVariableId,
} from "../playlists.js";

const WHITE = combineRgb(255, 255, 255);
const BLACK = combineRgb(0, 0, 0);
const RED = combineRgb(200, 0, 0);
const BLUE = combineRgb(0, 90, 160);
const SLATE = combineRgb(30, 40, 55);
const TEAL = combineRgb(0, 70, 80);

const liveFeedback = (playlist) => ({
  feedbackId: "playlist_is_live",
  options: { playlist },
  style: { bgcolor: RED, color: WHITE },
});

/**
 * Prev / current item / Next for one playlist option ("" = the selected playlist).
 * @param {(sectionId: string, key: string, preset: object) => void} add
 */
function addTransportRow(add, sectionId, keyBase, shown, playlist, varOf) {
  add(sectionId, `${keyBase}_prev`, {
    type: "simple",
    name: `${shown}: previous item`,
    style: {
      text: `◀ PREV\\n${varOf("prev_item")}`,
      size: "14",
      color: WHITE,
      bgcolor: SLATE,
    },
    steps: [
      { down: [{ actionId: "playlist_prev", options: { playlist } }], up: [] },
    ],
    feedbacks: [],
  });

  add(sectionId, `${keyBase}_current`, {
    type: "simple",
    name: `${shown}: current item (press = play from the start when live)`,
    style: {
      text: `${varOf("item")}\\n${varOf("position")}`,
      size: "14",
      color: WHITE,
      bgcolor: BLACK,
    },
    steps: [
      {
        down: [{ actionId: "playlist_restage", options: { playlist } }],
        up: [],
      },
    ],
    feedbacks: [liveFeedback(playlist)],
  });

  add(sectionId, `${keyBase}_next`, {
    type: "simple",
    name: `${shown}: next item`,
    style: {
      text: `NEXT ▶\\n${varOf("next_item")}`,
      size: "14",
      color: WHITE,
      bgcolor: SLATE,
    },
    steps: [
      { down: [{ actionId: "playlist_next", options: { playlist } }], up: [] },
    ],
    feedbacks: [],
  });
}

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {Array<{ id: string, name: string, definitions: string[] }>} structure
 * @param {(sectionId: string, key: string, preset: object) => void} add
 */
export function addPlaylistPresets(instance, structure, add) {
  const v = (variableId) => `$(${connectionLabel(instance)}:${variableId})`;
  const playlists = instance?._playlists || [];

  // ---- Selected playlist ---------------------------------------------------------------
  addTransportRow(
    add,
    "playlists",
    "playlist_sel",
    "Selected playlist",
    "",
    (f) => v(selectedPlaylistVariableId(f)),
  );

  add("playlists", "playlist_sel_name", {
    type: "simple",
    name: "Selected playlist: name (press = select next playlist)",
    style: {
      text: `${v(selectedPlaylistVariableId("name"))}\\n${v(selectedPlaylistVariableId("state"))}`,
      size: "14",
      color: WHITE,
      bgcolor: BLUE,
    },
    steps: [
      {
        down: [
          { actionId: "playlist_select_step", options: { direction: "next" } },
        ],
        up: [],
      },
    ],
    feedbacks: [liveFeedback("")],
  });

  for (const [dir, caption] of [
    ["prev", "◀ LIST"],
    ["next", "LIST ▶"],
  ]) {
    add("playlists", `playlist_select_${dir}`, {
      type: "simple",
      name: `Select ${dir === "prev" ? "previous" : "next"} playlist`,
      style: { text: caption, size: "14", color: WHITE, bgcolor: TEAL },
      steps: [
        {
          down: [
            { actionId: "playlist_select_step", options: { direction: dir } },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    });
  }

  // Built before any playlist exists: pick the playlist / item in the action editor.
  add("playlists", "playlist_pick_goto", {
    type: "simple",
    name: "Go to item (choose playlist + item)",
    style: { text: "GO TO\\nITEM 1", size: "14", color: WHITE, bgcolor: SLATE },
    steps: [
      {
        down: [
          { actionId: "playlist_goto", options: { playlist: "", item: 1 } },
        ],
        up: [],
      },
    ],
    feedbacks: [
      {
        feedbackId: "playlist_item_active",
        options: { playlist: "", item: 1 },
        style: { bgcolor: RED, color: WHITE },
      },
    ],
  });

  for (const p of playlists) {
    const key = playlistKey(p);
    add("playlists", `playlist_select_${playlistSlug(p)}`, {
      type: "simple",
      name: `Select ${playlistName(p)}`,
      style: {
        text: `${v(playlistVariableId(p, "name"))}`,
        size: "14",
        color: WHITE,
        bgcolor: SLATE,
      },
      steps: [
        {
          down: [{ actionId: "playlist_select", options: { playlist: key } }],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "playlist_is_selected",
          options: { playlist: key },
          style: { bgcolor: BLUE, color: WHITE },
        },
      ],
    });
  }

  // ---- One section per playlist --------------------------------------------------------
  for (const p of playlists) {
    const key = playlistKey(p);
    const slug = playlistSlug(p);
    const sectionId = `playlist_${slug}`;
    const shown = playlistName(p);
    structure.push({
      id: sectionId,
      name: `HighAsCG · Playlist · ${shown}`,
      definitions: [],
    });

    addTransportRow(add, sectionId, `playlist_${slug}`, shown, key, (f) =>
      v(playlistVariableId(p, f)),
    );

    const n = Math.min(p.items.length, MAX_ITEM_SLOTS);
    for (let i = 0; i < n; i++) {
      add(sectionId, `playlist_${slug}_item_${i + 1}`, {
        type: "simple",
        name: `${shown}: go to item ${i + 1}`,
        style: {
          text: `${i + 1}\\n${v(playlistVariableId(p, `item_${i + 1}`))}`,
          size: "14",
          color: WHITE,
          bgcolor: BLACK,
        },
        steps: [
          {
            down: [
              {
                actionId: "playlist_goto",
                options: { playlist: key, item: i + 1 },
              },
            ],
            up: [],
          },
        ],
        feedbacks: [
          {
            feedbackId: "playlist_item_active",
            options: { playlist: key, item: i + 1 },
            style: { bgcolor: RED, color: WHITE },
          },
        ],
      });
    }
  }
}
