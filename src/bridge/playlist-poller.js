/**
 * @file playlist-poller.js
 * Keeps the playlist variables live: polls GET /api/playlist/state (the server has no push for
 * playlist position — the web panel polls it too). Auto-advancing playlists change item on their
 * own, so the item-name variables must follow without a button press; actions also call
 * `fetchNow()` so a pressed Next re-captions the button at once.
 */

import { getBridgePort } from "../host-target.js";
import {
  playlistCatalogSignature,
  playlistVariableValues,
  selectedPlaylist,
  sortPlaylists,
} from "../playlists.js";

/** ~12 ms server-side per read; 1 s keeps an auto-advancing item name close to the output. */
const POLL_MS = 1000;

/** Feedbacks whose truth depends on the polled list or the Companion selection. */
export const PLAYLIST_FEEDBACK_IDS = [
  "playlist_item_active",
  "playlist_is_live",
  "playlist_is_selected",
];

class PlaylistPoller {
  /** @param {import('../instance.js').HighAsCGInstance} instance */
  constructor(instance) {
    this.instance = instance;
    this._pollTimer = null;
    this._inFlight = null;
    this._catalogSig = null;
    /** Signature of the last published values, so an idle playlist writes nothing. */
    this._lastSig = "";
  }

  get baseUrl() {
    const host = this.instance.getActiveHost();
    return `http://${host}:${getBridgePort(this.instance.config)}`;
  }

  async fetchNow() {
    if (this._inFlight) return this._inFlight;
    this._inFlight = this._doFetch().finally(() => {
      this._inFlight = null;
    });
    return this._inFlight;
  }

  async _doFetch() {
    try {
      const res = await fetch(`${this.baseUrl}/api/playlist/state`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.ok || !Array.isArray(data.playlists)) return;
      this.instance._playlists = sortPlaylists(data.playlists);

      // Dropdowns list the playlists, definitions are one block per playlist + per item, and
      // presets are one button set per playlist — all rebuilt only when the catalog changes.
      const sig = playlistCatalogSignature(this.instance._playlists);
      if (sig !== this._catalogSig) {
        this._catalogSig = sig;
        this.instance.updateActions();
        this.instance.updateFeedbacks();
        this.instance.updateVariables();
        this.instance.updatePresets();
        this._lastSig = ""; // definitions changed — force a value publish
      }
      this.publish();
    } catch (e) {
      this.instance.log("debug", `playlist poller: ${e.message || e}`);
    }
  }

  /** Recompute and publish the variables (also after the Companion selection changes). */
  publish() {
    const list = this.instance._playlists || [];
    const vars = playlistVariableValues(list, selectedPlaylist(this.instance));
    const sig = `${this.instance._selectedPlaylistKey || ""}\n${JSON.stringify(vars)}`;
    if (sig === this._lastSig) return;
    this._lastSig = sig;
    this.instance.setVariableValues(vars);
    this.instance.checkFeedbacks(...PLAYLIST_FEEDBACK_IDS);
  }

  start() {
    this.stop();
    this._pollTimer = setInterval(() => void this.fetchNow(), POLL_MS);
    if (this._pollTimer.unref) this._pollTimer.unref();
    void this.fetchNow();
  }

  stop() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
}

export { PlaylistPoller };
