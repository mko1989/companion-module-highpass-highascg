/**
 * @file playlists.js
 * HighAsCG playlist model for Companion — mirrors the web UI's Playlists footer panel
 * (client/components/playlist-control-panel.js). GET /api/playlist/state lists every playlist
 * layer: the ones live on a program channel, looks recalled on preview, and every playlist
 * defined in the project's looks (not live yet). The same transport rules apply:
 *
 *  - live playlist: prev / next / goto move the running item on program;
 *  - not live: prev / next / goto move the sticky START item (what a PRV recall shows and what
 *    the take to PGM begins on) — server actions `step_preview` / `set_start`.
 *
 * Companion keeps its own "selected playlist" cursor (like the panel's playlist dropdown) so one
 * set of Prev / Item / Next buttons can drive whichever playlist the operator picked.
 */

/** Items that get their own variable + goto preset per playlist (a very long list stays usable). */
export const MAX_ITEM_SLOTS = 64;

/** Stable identity of a playlist: the look and its layer (same key the web panel uses). */
export function playlistKey(p) {
  return `${p?.sceneId ?? ""}:${p?.layerNumber ?? ""}`;
}

/** Short variable-safe slug: first 8 alphanumerics of the look id + the layer. */
export function playlistSlug(p) {
  const scene = String(p?.sceneId ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toLowerCase();
  return `${scene || "look"}_l${parseInt(p?.layerNumber, 10) || 0}`;
}

/** @param {object} p @param {string} field */
export function playlistVariableId(p, field) {
  return `highascg_playlist_${playlistSlug(p)}_${field}`;
}

/** Selected-playlist variable id. */
export function selectedPlaylistVariableId(field) {
  return `highascg_playlist_sel_${field}`;
}

/** Index shown as "current": the running item when live, else the start item. */
export function currentIndex(p) {
  const n = p?.live ? p.activeIndex : p?.startIndex;
  const len = Array.isArray(p?.items) ? p.items.length : 0;
  const i = parseInt(n, 10);
  if (!len) return -1;
  return Number.isFinite(i) && i >= 0 && i < len ? i : 0;
}

/**
 * Button-friendly item name. A file-backed item (label is the path/file) shows its base name
 * without extension — `projects/airport/01Rajesh.PNG` → `01Rajesh`; a custom label is kept as is.
 * @param {{ label?: string, value?: string } | null | undefined} item
 */
export function itemName(item) {
  if (!item) return "";
  const label = String(item.label ?? item.value ?? "");
  const isFile = label === String(item.value ?? "") || /[\\/]/.test(label);
  const base =
    label.replace(/\\/g, "/").split("/").filter(Boolean).pop() || label;
  return isFile ? base.replace(/\.[A-Za-z0-9]{2,5}$/, "") : base;
}

/** "Look · L11" — how a playlist is named on buttons and in dropdowns. */
export function playlistName(p) {
  return `${String(p?.sceneName || p?.sceneId || "Look").slice(0, 40)} · L${p?.layerNumber ?? "?"}`;
}

/** live | preview | ready — where the playlist is right now. */
export function playlistState(p) {
  if (p?.live) return "live";
  if (p?.previewChannel != null) return "preview";
  return "ready";
}

/**
 * The polled list, de-duplicated by key, in a stable order (look name, then layer). The server
 * lists live ones first, which would reshuffle the dropdowns every time a look goes on air.
 * @param {object[]} playlists — GET /api/playlist/state `playlists`
 */
export function sortPlaylists(playlists) {
  const seen = new Set();
  const out = [];
  for (const p of Array.isArray(playlists) ? playlists : []) {
    if (!p || !Array.isArray(p.items)) continue;
    const k = playlistKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out.sort(
    (a, b) =>
      String(a.sceneName || "").localeCompare(String(b.sceneName || "")) ||
      (Number(a.layerNumber) || 0) - (Number(b.layerNumber) || 0) ||
      String(a.sceneId).localeCompare(String(b.sceneId)),
  );
}

/**
 * The Companion-selected playlist: the operator's pick when it still exists, else the first live
 * one, else the first one.
 * @param {{ _playlists?: object[], _selectedPlaylistKey?: string }} instance
 */
export function selectedPlaylist(instance) {
  const list = instance?._playlists || [];
  const wanted = String(instance?._selectedPlaylistKey || "");
  return (
    (wanted && list.find((p) => playlistKey(p) === wanted)) ||
    list.find((p) => p.live) ||
    list[0] ||
    null
  );
}

/**
 * An action/feedback option → playlist: a key, or empty for the selected playlist.
 * @param {{ _playlists?: object[], _selectedPlaylistKey?: string }} instance
 * @param {string} option
 */
export function resolvePlaylist(instance, option) {
  const wanted = String(option ?? "").trim();
  if (!wanted) return selectedPlaylist(instance);
  return (
    (instance?._playlists || []).find((p) => playlistKey(p) === wanted) || null
  );
}

/** Dropdown: "Selected playlist" plus every playlist that exists. */
export function buildPlaylistDropdown(instance, { withSelected = true } = {}) {
  const choices = withSelected ? [{ id: "", label: "Selected playlist" }] : [];
  for (const p of instance?._playlists || []) {
    choices.push({ id: playlistKey(p), label: playlistName(p) });
  }
  return {
    choices,
    default: choices[0]?.id ?? "",
    minChoicesForSearch: 8,
  };
}

/** Fields published per playlist (and for the selected one). */
export const PLAYLIST_VARIABLE_FIELDS = [
  ["name", "name (look · layer)"],
  ["item", "current item name"],
  ["item_number", "current item number (1-based)"],
  ["next_item", "next item name"],
  ["prev_item", "previous item name"],
  ["count", "number of items"],
  ["position", "position (3/15)"],
  ["state", "state (live/preview/ready)"],
  ["channel", "program channel when live"],
];

function fieldValues(p) {
  if (!p) {
    return {
      name: "",
      item: "",
      item_number: 0,
      next_item: "",
      prev_item: "",
      count: 0,
      position: "",
      state: "",
      channel: "",
    };
  }
  const items = p.items || [];
  const len = items.length;
  const i = currentIndex(p);
  // Wrap like the server's next/prev; a non-looping playlist's end simply has no next item.
  const loops = p.loop !== false;
  const next = i + 1 < len ? items[i + 1] : loops ? items[0] : null;
  const prev = i > 0 ? items[i - 1] : loops ? items[len - 1] : null;
  return {
    name: playlistName(p),
    item: itemName(items[i]),
    item_number: i + 1,
    next_item: itemName(next),
    prev_item: itemName(prev),
    count: len,
    position: len ? `${i + 1}/${len}` : "",
    state: playlistState(p),
    channel: p.live && p.channel != null ? String(p.channel) : "",
  };
}

/**
 * Variable definitions for the playlists that exist now: the selected-playlist block, one block
 * per playlist, and one name variable per item (for item goto buttons).
 * @param {object[]} playlists — sorted
 * @returns {{ variableId: string, name: string }[]}
 */
export function playlistVariableDefinitions(playlists = []) {
  const defs = [
    {
      variableId: "highascg_playlist_count",
      name: "Playlists: number of playlists",
    },
  ];
  for (const [field, what] of PLAYLIST_VARIABLE_FIELDS) {
    defs.push({
      variableId: selectedPlaylistVariableId(field),
      name: `Selected playlist: ${what}`,
    });
  }
  for (const p of playlists) {
    const label = playlistName(p);
    for (const [field, what] of PLAYLIST_VARIABLE_FIELDS) {
      defs.push({
        variableId: playlistVariableId(p, field),
        name: `Playlist "${label}": ${what}`,
      });
    }
    const n = Math.min(p.items.length, MAX_ITEM_SLOTS);
    for (let i = 0; i < n; i++) {
      defs.push({
        variableId: playlistVariableId(p, `item_${i + 1}`),
        name: `Playlist "${label}": item ${i + 1} name`,
      });
    }
  }
  return defs;
}

/**
 * @param {object[]} playlists — sorted
 * @param {object|null} selected
 * @returns {Record<string, string|number>}
 */
export function playlistVariableValues(playlists = [], selected = null) {
  /** @type {Record<string, string|number>} */
  const vars = { highascg_playlist_count: playlists.length };
  for (const [field, value] of Object.entries(fieldValues(selected))) {
    vars[selectedPlaylistVariableId(field)] = value;
  }
  for (const p of playlists) {
    for (const [field, value] of Object.entries(fieldValues(p))) {
      vars[playlistVariableId(p, field)] = value;
    }
    const n = Math.min(p.items.length, MAX_ITEM_SLOTS);
    for (let i = 0; i < n; i++) {
      vars[playlistVariableId(p, `item_${i + 1}`)] = itemName(p.items[i]);
    }
  }
  return vars;
}

/**
 * Structural signature: which playlists exist and their item counts. Definitions, dropdowns and
 * presets are rebuilt only when this changes.
 * @param {object[]} playlists
 */
export function playlistCatalogSignature(playlists = []) {
  return playlists
    .map(
      (p) =>
        `${playlistKey(p)}#${Math.min(p.items.length, MAX_ITEM_SLOTS)}#${playlistName(p)}`,
    )
    .join("\n");
}
