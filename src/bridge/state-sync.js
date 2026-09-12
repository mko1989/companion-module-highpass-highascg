/**
 * @file state-sync.js
 * Maps HighAsCG WebSocket / REST snapshots to Companion variables.
 * Server `variables` are passed through with prefix `highascg_`; definitions are
 * registered dynamically from the current key set (no static OSC/channel grids).
 */

import getVariables from "../variables.js";
import { refreshLookAirFeedbacks } from "../look-feedback-ids.js";
import { msToHms } from "../time-format.js";
import { isComposePreviewButtonsEnabled } from "../compose-preview-channels.js";
import { PreviewVariableGate } from "../preview-variable-gate.js";
import { sendCompanionHello } from "./companion-hello.js";
import { PREVIEW } from "./contract.js";
import { syncScreenLabelVariables } from "../look-vars.js";

function _str(v) {
  if (v == null) return "";
  return String(v);
}

function _timelineDurationMs(list, timelineId) {
  if (!Array.isArray(list) || !timelineId) return null;
  const tl = list.find((t) => t && String(t.id) === String(timelineId));
  if (!tl || typeof tl.duration !== "number") return null;
  return Math.round(tl.duration);
}

function _timelineName(list, timelineId) {
  if (!Array.isArray(list) || !timelineId) return "";
  const tl = list.find((t) => t && String(t.id) === String(timelineId));
  return tl && tl.name ? String(tl.name) : "";
}

function _deepMergeTimeline(a, b) {
  const out = { ...(a || {}) };
  if (!b || typeof b !== "object") return out;
  if (b.list != null) out.list = b.list;
  if (b.playback != null) out.playback = b.playback;
  if (b.tick != null && b.tick.timelineId != null) {
    out.playback = {
      ...(out.playback || {}),
      timelineId: b.tick.timelineId,
      position: b.tick.position,
      playing: true,
    };
  }
  return out;
}

function _deepMergeScene(a, b) {
  const out = { ...(a || {}) };
  if (!b || typeof b !== "object") return out;
  if (b.live != null) out.live = b.live;
  // WO-572 (HighAsCG) — audio-only looks live in a SEPARATE map from scene.live (a screen can
  // have one live video look and one live audio-only look at once); this was silently dropped
  // here even after the server started sending it, so no fresh client (a reconnect, or this
  // module's own HTTP getState() bootstrap) ever saw audio-only look state at all.
  if (b.liveAudioOnly != null) out.liveAudioOnly = b.liveAudioOnly;
  if (b.deck != null) out.deck = b.deck;
  return out;
}

/** Human-readable Companion label for a HighAsCG `variables` key. */
function _labelForServerKey(key) {
  const preview = key.match(/^compose_preview_ch(\d+)_image$/);
  if (preview) {
    return `Compose preview ch${preview[1]} (button image data URI)`;
  }
  const quad = key.match(/^compose_preview_ch(\d+)_quad_(tl|tr|bl|br)$/);
  if (quad) {
    return `Compose preview ch${quad[1]} quadrant ${quad[2].toUpperCase()}`;
  }
  const lookAir = key.match(/^look_air_frame_(.+)$/);
  if (lookAir) {
    return `Look on-air still (${lookAir[1]})`;
  }
  if (key.startsWith("ui_selection_")) {
    const tail = key.slice("ui_selection_".length).replace(/_/g, " ");
    return `UI selection: ${tail}`;
  }
  const oscLayer = key.match(/^osc_ch(\d+)_l(\d+)_(.+)$/);
  if (oscLayer) {
    return `OSC ch${oscLayer[1]} layer ${oscLayer[2]} ${oscLayer[3]}`;
  }
  const oscCh = key.match(/^osc_ch(\d+)_(audio_[LR]|healthy)$/);
  if (oscCh) {
    return `OSC ch${oscCh[1]} ${oscCh[2].replace("_", " ")}`;
  }
  const map = {
    app_uptime: "App uptime",
    app_memory_usage: "App memory usage",
    caspar_connected: "Caspar connected",
    caspar_version: "Caspar version",
  };
  if (map[key]) return map[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

class HighAsCGStateSync {
  constructor(instance) {
    this.instance = instance;
    /** @type {{ timeline?: object, scene?: object, variables?: Record<string, string>, channelMap?: object }} */
    this._merged = {};
    /** @type {string} — serialized key set; only refresh defs when it changes */
    this._serverVarKeysSig = "";
    /** @type {string} */
    this._channelMapSig = "";
    this._previewGate = new PreviewVariableGate();
  }

  /** Latest server variable value (unprefixed key as in HighAsCG `state.variables`). */
  getServerVariable(key) {
    const k = String(key ?? "");
    if (!k) return "";
    const raw = this._merged.variables?.[k];
    return raw != null ? String(raw) : "";
  }

  _serverVariableKeysSignature() {
    return Object.keys(this._merged.variables || {})
      .sort()
      .join("\0");
  }

  _syncVariableDefinitionsFromMerged() {
    const base = getVariables(this.instance);
    const staticIds = new Set(Object.keys(base));
    const raw = this._merged.variables || {};
    /** @type {Record<string, { name: string }>} */
    const serverDefs = {};
    for (const key of Object.keys(raw).sort()) {
      const variableId = `highascg_${key}`;
      if (staticIds.has(variableId)) continue;
      serverDefs[variableId] = { name: _labelForServerKey(key) };
    }
    this.instance.setVariableDefinitions({ ...base, ...serverDefs });
  }

  _isPreviewVariableKey(key) {
    const k = String(key);
    return (
      PREVIEW.COMPOSE_IMAGE_RE.test(k) ||
      PREVIEW.COMPOSE_QUAD_RE.test(k) ||
      PREVIEW.LOOK_AIR_FRAME_RE.test(k)
    );
  }

  _hasPreviewVariables(variables) {
    if (!variables || typeof variables !== "object") return false;
    return Object.keys(variables).some((key) =>
      this._isPreviewVariableKey(key),
    );
  }

  _hasNonPreviewVariables(variables) {
    if (!variables || typeof variables !== "object") return false;
    return Object.keys(variables).some(
      (key) => !this._isPreviewVariableKey(key),
    );
  }

  _composePreviewButtonsEnabled() {
    return isComposePreviewButtonsEnabled(this.instance?.config);
  }

  /**
   * @param {Record<string, string>} variables
   * @returns {Record<string, string>}
   */
  _withoutPreviewVariables(variables) {
    if (!variables || typeof variables !== "object") return {};
    if (this._composePreviewButtonsEnabled()) return variables;
    /** @type {Record<string, string>} */
    const out = {};
    for (const [key, val] of Object.entries(variables)) {
      if (!this._isPreviewVariableKey(key)) out[key] = val;
    }
    return out;
  }

  _refreshLookAirFeedbacks() {
    refreshLookAirFeedbacks(this.instance);
  }

  _maybeSyncVariableDefinitions() {
    const sig = this._serverVariableKeysSignature();
    if (sig === this._serverVarKeysSig) return;
    this._serverVarKeysSig = sig;
    this._syncVariableDefinitionsFromMerged();
  }

  /** Expose latest scene.live (+ scene.liveAudioOnly) + channel map for look PGM/PRV feedbacks. */
  _syncFeedbackContext() {
    const scene = this._merged.scene || {};
    this.instance._sceneLive =
      scene.live && typeof scene.live === "object" ? scene.live : {};
    this.instance._sceneLiveAudioOnly =
      scene.liveAudioOnly && typeof scene.liveAudioOnly === "object"
        ? scene.liveAudioOnly
        : {};
    const prevLabels = JSON.stringify(
      this.instance._channelMap?.screenLabels || [],
    );
    this.instance._channelMap = this._merged.channelMap || null;
    // WO-384: preset button captions read the screen name from a variable, so it has to follow a
    // rename in HighAsCG rather than being frozen at preset-build time.
    if (
      prevLabels !==
      JSON.stringify(this.instance._channelMap?.screenLabels || [])
    ) {
      syncScreenLabelVariables(this.instance);
    }
  }

  /**
   * Merge partial snapshot vars and push to Companion (hash dedupe on preview images).
   * @param {Record<string, string>} variables — unprefixed HighAsCG keys
   */
  _pushServerVariables(variables) {
    if (!variables || typeof variables !== "object") return;
    if (Object.keys(variables).length === 0) return;

    this._merged.variables = {
      ...(this._merged.variables || {}),
      ...variables,
    };
    this._maybeSyncVariableDefinitions();
    /** @type {Record<string, string>} */
    const values = {};
    for (const [key, val] of Object.entries(variables)) {
      values[`highascg_${key}`] = val;
    }
    this.instance.setVariableValues(values);
    if (this._composePreviewButtonsEnabled()) {
      for (const [key, val] of Object.entries(variables)) {
        const m = String(key).match(/^compose_preview_ch(\d+)_image$/);
        if (m) {
          this.instance._lookAirFrames?.onChannelPreview(
            parseInt(m[1], 10),
            val,
          );
        }
      }
    }
    if (this._hasNonPreviewVariables(variables)) {
      refreshLookAirFeedbacks(this.instance);
    }
  }

  /**
   * Partial variable updates from WebSocket `variable_update` — merge into snapshot.
   * @param {Record<string, string>} variables
   */
  updateVariables(variables) {
    if (!variables || typeof variables !== "object") return;
    const stripped = this._withoutPreviewVariables(variables);
    if (Object.keys(stripped).length === 0) return;
    const filtered = this._previewGate.filterServerBatch(stripped);
    this._pushServerVariables(filtered);
  }

  /**
   * Merge partial snapshot (WS) or full snapshot (HTTP) and push derived variables.
   * @param {object} data
   */
  applyFullState(data) {
    if (!data || typeof data !== "object") return;

    if (data.variables && typeof data.variables === "object") {
      const prev = this._merged.variables || {};
      const next = { ...data.variables };
      /** @type {Record<string, string>} */
      const toPush = { ...next };
      for (const k of Object.keys(prev)) {
        if (!(k in next)) toPush[k] = "";
      }
      this._merged.variables = next;
      this._maybeSyncVariableDefinitions();
      const stripped = this._withoutPreviewVariables(toPush);
      const filtered = this._previewGate.filterServerBatch(stripped);
      this._pushServerVariables(filtered);
    }

    // WO-394: no direct AMCP socket anymore — the app's own Caspar link state feeds the
    // `caspar_connected` feedback instead.
    if (data.caspar !== undefined) {
      const was = !!this.instance._casparStatus?.connected;
      this.instance._casparStatus = data.caspar || null;
      if (was !== !!data.caspar?.connected) {
        this.instance.checkFeedbacks("caspar_connected");
      }
    }

    const prevLive = this.instance._sceneLive;

    if (data.timeline !== undefined) {
      this._merged.timeline = _deepMergeTimeline(
        this._merged.timeline,
        data.timeline,
      );
    }
    if (data.scene !== undefined) {
      this._merged.scene = _deepMergeScene(this._merged.scene, data.scene);
    }

    if (data.channelMap !== undefined) {
      this._merged.channelMap = data.channelMap;
      const sig = JSON.stringify(data.channelMap?.programChannels || []);
      if (sig !== this._channelMapSig) {
        this._channelMapSig = sig;
        if (typeof this.instance.updatePresets === "function") {
          this.instance.updatePresets();
        }
        sendCompanionHello(this.instance);
      }
    }

    if (
      data.scene?.deck &&
      typeof this.instance.applySceneDeck === "function"
    ) {
      this.instance.applySceneDeck(data.scene.deck);
    }

    if (data.scene_deck && typeof this.instance.applySceneDeck === "function") {
      this.instance.applySceneDeck(data.scene_deck);
    }

    this._syncFeedbackContext();

    if (data.scene !== undefined) {
      const nextLive =
        this.instance._sceneLive && typeof this.instance._sceneLive === "object"
          ? this.instance._sceneLive
          : {};
      this.instance._lookAirFrames?.syncFromSceneLive(prevLive, nextLive);
      this._refreshLookAirFeedbacks();
    }

    const timelineChanged = data.timeline !== undefined;
    /** @type {Record<string, string>} */
    const values = {};
    const tl = this._merged.timeline || {};
    const list = Array.isArray(tl.list) ? tl.list : [];
    const playback =
      tl.playback && typeof tl.playback === "object"
        ? { ...tl.playback }
        : null;

    const tid = playback?.timelineId != null ? String(playback.timelineId) : "";
    const dur = _timelineDurationMs(list, tid);
    const pos =
      playback && playback.position != null
        ? Math.round(Number(playback.position))
        : null;
    const playing = !!(playback && playback.playing);
    const loop = !!(playback && playback.loop);

    values.highascg_timeline_id = tid;
    values.highascg_timeline_name = _timelineName(list, tid);
    values.highascg_timeline_playing = playing ? "true" : "false";
    values.highascg_timeline_loop = loop ? "true" : "false";
    values.highascg_timeline_position_ms = pos != null ? _str(pos) : "";
    values.highascg_timeline_duration_ms = dur != null ? _str(dur) : "";
    if (dur != null && pos != null) {
      values.highascg_timeline_remaining_ms = _str(Math.max(0, dur - pos));
    } else {
      values.highascg_timeline_remaining_ms = "";
    }
    values.highascg_timeline_position = pos != null ? msToHms(pos) : "";
    values.highascg_timeline_duration = dur != null ? msToHms(dur) : "";
    values.highascg_timeline_remaining =
      dur != null && pos != null ? msToHms(Math.max(0, dur - pos)) : "";

    this.instance.setVariableValues(values);
    if (timelineChanged) {
      this.instance.checkAllFeedbacks();
    }
  }
}

export { HighAsCGStateSync };
