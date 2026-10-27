/**
 * @file playlist-actions.js
 * Playlist transport for HighAsCG list-mode look layers — the same controls as the web UI's
 * Playlists panel (POST /api/playlist/control):
 *
 *  - live playlist: Next / Prev / Go to move the running item on program (`next|prev|goto`);
 *  - not live: they move the start item (`step_preview` / `set_start`) — what a PRV recall
 *    shows and where the take to PGM begins. Nothing is sent to a program channel.
 *
 * Every action takes a playlist; the empty choice means Companion's selected playlist, so one
 * Prev / Item / Next button row follows whatever `Playlist: Select` last picked.
 */

import {
  buildPlaylistDropdown,
  currentIndex,
  playlistKey,
  playlistName,
  resolvePlaylist,
  selectedPlaylist,
} from "../playlists.js";

export default function (instance) {
  const playlistOption = () => ({
    type: "dropdown",
    id: "playlist",
    label: "Playlist",
    ...buildPlaylistDropdown(instance),
  });

  const target = (action) => {
    const api = instance.bridge?.api;
    if (!api) return null;
    const p = resolvePlaylist(instance, action.options?.playlist);
    if (!p) {
      instance.log("warn", "Playlist: no such playlist (none in the project?)");
      return null;
    }
    return { p, api };
  };

  const send = async (label, body) => {
    try {
      await instance.bridge.api.playlistControl(body);
    } catch (e) {
      instance.log("error", `Playlist ${label}: ${e.message || e}`);
    }
    instance.refreshPlaylists?.();
  };

  /** @param {object} action @param {'next'|'prev'} direction */
  const step = async (action, direction) => {
    const t = target(action);
    if (!t) return;
    const { p } = t;
    if (p.live) {
      await send(direction, {
        channel: p.channel,
        layerNumber: p.layerNumber,
        action: direction,
      });
    } else {
      await send(direction, {
        action: "step_preview",
        sceneId: p.sceneId,
        layerNumber: p.layerNumber,
        direction,
      });
    }
  };

  /** @param {object} p @param {number} index — 0-based */
  const goTo = async (p, index) => {
    if (p.live) {
      await send("go to", {
        channel: p.channel,
        layerNumber: p.layerNumber,
        action: "goto",
        index,
      });
    } else {
      await send("go to", {
        action: "set_start",
        sceneId: p.sceneId,
        layerNumber: p.layerNumber,
        index,
      });
    }
  };

  return {
    playlist_next: {
      name: "Playlist: Next item",
      description:
        "Live: plays the next item. Not live: moves the start item (and the PRV render) on.",
      options: [playlistOption()],
      callback: async (action) => step(action, "next"),
    },

    playlist_prev: {
      name: "Playlist: Previous item",
      description:
        "Live: plays the previous item. Not live: moves the start item (and the PRV render) back.",
      options: [playlistOption()],
      callback: async (action) => step(action, "prev"),
    },

    playlist_goto: {
      name: "Playlist: Go to item",
      description:
        "Live: jumps to the item. Not live: makes it the start item for the next take.",
      options: [
        playlistOption(),
        {
          type: "number",
          id: "item",
          label: "Item number (1-based)",
          default: 1,
          min: 1,
          max: 9999,
        },
      ],
      callback: async (action) => {
        const t = target(action);
        if (!t) return;
        const n = parseInt(action.options?.item, 10) || 1;
        if (n < 1 || n > t.p.items.length) {
          instance.log(
            "warn",
            `Playlist go to: item ${n} out of range (1-${t.p.items.length})`,
          );
          return;
        }
        await goTo(t.p, n - 1);
      },
    },

    playlist_restage: {
      name: "Playlist: Play current item from the start",
      description:
        "Restages the current item. Only applies to a live playlist.",
      options: [playlistOption()],
      callback: async (action) => {
        const t = target(action);
        if (!t) return;
        if (!t.p.live) {
          instance.log("warn", "Playlist restage: the playlist is not live");
          return;
        }
        await goTo(t.p, Math.max(0, currentIndex(t.p)));
      },
    },

    playlist_select: {
      name: "Playlist: Select playlist",
      description:
        "Sets which playlist the 'Selected playlist' buttons and variables follow.",
      options: [
        {
          type: "dropdown",
          id: "playlist",
          label: "Playlist",
          ...buildPlaylistDropdown(instance, { withSelected: false }),
        },
      ],
      callback: async (action) => {
        const key = String(action.options?.playlist || "");
        const p = (instance._playlists || []).find(
          (x) => playlistKey(x) === key,
        );
        if (!p) {
          instance.log(
            "warn",
            "Playlist select: that playlist no longer exists",
          );
          return;
        }
        instance.selectPlaylist(key);
        instance.log("debug", `Playlist selected: ${playlistName(p)}`);
      },
    },

    playlist_select_step: {
      name: "Playlist: Select next / previous playlist",
      options: [
        {
          type: "dropdown",
          id: "direction",
          label: "Direction",
          default: "next",
          choices: [
            { id: "next", label: "Next playlist" },
            { id: "prev", label: "Previous playlist" },
          ],
        },
      ],
      callback: async (action) => {
        const list = instance._playlists || [];
        if (!list.length) return;
        const cur = selectedPlaylist(instance);
        const i = cur ? list.indexOf(cur) : -1;
        const d = action.options?.direction === "prev" ? -1 : 1;
        const next =
          list[(((i + d) % list.length) + list.length) % list.length];
        instance.selectPlaylist(playlistKey(next));
      },
    },
  };
}
