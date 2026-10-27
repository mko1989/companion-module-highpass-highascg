/**
 * @file playlist-feedbacks.js
 * Tally for the playlist buttons — re-checked by the playlist poller on every change.
 */

import { combineRgb } from "@companion-module/base";
import {
  buildPlaylistDropdown,
  currentIndex,
  playlistKey,
  resolvePlaylist,
  selectedPlaylist,
} from "./playlists.js";

/** @param {import('./instance.js').HighAsCGInstance} instance */
export default function getPlaylistFeedbacks(instance) {
  const playlistOption = () => ({
    type: "dropdown",
    id: "playlist",
    label: "Playlist",
    ...buildPlaylistDropdown(instance),
  });

  return {
    playlist_item_active: {
      type: "boolean",
      name: "Playlist: item is current",
      description:
        "True when this item is the playlist's current item (playing when live, the start item otherwise).",
      defaultStyle: {
        bgcolor: combineRgb(200, 0, 0),
        color: combineRgb(255, 255, 255),
      },
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
      callback: (feedback) => {
        const p = resolvePlaylist(instance, feedback.options.playlist);
        if (!p) return false;
        return (
          currentIndex(p) === (parseInt(feedback.options.item, 10) || 1) - 1
        );
      },
    },

    playlist_is_live: {
      type: "boolean",
      name: "Playlist: is live on program",
      defaultStyle: {
        bgcolor: combineRgb(200, 0, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [playlistOption()],
      callback: (feedback) =>
        !!resolvePlaylist(instance, feedback.options.playlist)?.live,
    },

    playlist_is_selected: {
      type: "boolean",
      name: "Playlist: is the selected playlist",
      defaultStyle: {
        bgcolor: combineRgb(0, 90, 160),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "dropdown",
          id: "playlist",
          label: "Playlist",
          ...buildPlaylistDropdown(instance, { withSelected: false }),
        },
      ],
      callback: (feedback) => {
        const sel = selectedPlaylist(instance);
        return (
          !!sel && playlistKey(sel) === String(feedback.options.playlist || "")
        );
      },
    },
  };
}
