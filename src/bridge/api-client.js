/**
 * @file api-client.js
 * Companion module bridge to HighAsCG REST API.
 */

import { getBridgePort } from "../host-target.js";

/** Avoid hung fetch (Companion IPC action timeout) when host is wrong or unreachable. */
const FETCH_TIMEOUT_MS = 20000;

class HighAsCGApi {
  constructor(instance) {
    this.instance = instance;
  }

  get baseUrl() {
    const host = this.instance.getActiveHost();
    return `http://${host}:${getBridgePort(this.instance.config)}`;
  }

  async _post(path, body = {}) {
    const url = `${this.baseUrl}${path}`;
    this.instance.log("debug", `HighAsCG REST POST: ${url}`);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        return await response.json();
      }
      return {};
    } catch (err) {
      this.instance.log("error", `HighAsCG API Error: ${err.message}`);
      throw err;
    }
  }

  async _get(path) {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      this.instance.log("error", `HighAsCG API Error: ${err.message}`);
      throw err;
    }
  }

  /** Full app state (includes timeline, scene.live, playback.matrix, variables, …). */
  async getState() {
    return this._get("/api/state");
  }

  /**
   * Read-only project JSON from disk mirror (GET /api/project).
   * Does not POST /api/project/load — that route applies hardware/multiview on the server.
   */
  async getProject() {
    return this._get("/api/project");
  }

  /**
   * Active project load on server (applies hardwareConfig / multiview). Use only for explicit operator actions.
   */
  async loadProjectFromCaspar() {
    return this._post("/api/project/load", {});
  }

  /** Full project bundle (includes nested project JSON when server exposes it). */
  async getProjectBundle() {
    return this._get("/api/project/bundle");
  }

  async getTimelines() {
    return this._get("/api/timelines");
  }

  async getTimelinePlayback(timelineId) {
    return this._get(
      `/api/timelines/${encodeURIComponent(timelineId)}/state`,
    );
  }

  /**
   * @param {object} opts
   * @param {number} opts.channel — program channel (1-based)
   * @param {object} opts.incomingScene — full look JSON (see buildIncomingScenePayload)
   * @param {number} [opts.framerate]
   * @param {boolean} [opts.forceCut]
   * @param {'lbg'|undefined} [opts.takeMode] — `lbg` = LOADBG+MIX then PLAY (test path; not dual-bank crossfade)
   */
  async sceneTake(opts) {
    const {
      channel,
      incomingScene,
      sceneId,
      framerate = 50,
      forceCut = false,
      useServerLive = true,
      takeMode,
    } = opts;
    /** @type {Record<string, unknown>} */
    const body = {
      channel,
      framerate,
      forceCut,
      useServerLive,
    };
    if (sceneId != null && String(sceneId).trim()) {
      body.sceneId = String(sceneId).trim();
    }
    if (incomingScene && typeof incomingScene === "object") {
      body.incomingScene = incomingScene;
    }
    if (takeMode === "lbg") body.takeMode = "lbg";
    if (opts.target) body.target = opts.target;
    if (opts.bus) body.bus = opts.bus;
    if (opts.stageOnPreview === false) body.stageOnPreview = false;
    return this._post("/api/scene/take", body);
  }

  async timelinePlay(id, options = {}) {
    return this._post(`/api/timelines/${encodeURIComponent(id)}/play`, options);
  }

  async timelinePause(id) {
    return this._post(`/api/timelines/${encodeURIComponent(id)}/pause`, {});
  }

  async timelineStop(id) {
    return this._post(`/api/timelines/${encodeURIComponent(id)}/stop`, {});
  }

  async timelineSeek(id, ms) {
    return this._post(`/api/timelines/${encodeURIComponent(id)}/seek`, {
      ms,
    });
  }

  async timelineLoop(id, loop) {
    return this._post(`/api/timelines/${encodeURIComponent(id)}/loop`, {
      loop,
    });
  }

  async setAudioVolume(channel, volume, layer = null) {
    const body = { channel, volume, master: !layer };
    if (layer) body.layer = layer;
    return this._post("/api/audio/volume", body);
  }

  async setSelection(body) {
    return this._post("/api/selection", body);
  }

  async mixerFill(body) {
    return this._post("/api/mixer/fill", body);
  }

  async mixerClip(body) {
    return this._post("/api/mixer/clip", body);
  }

  async mixerAnchor(body) {
    return this._post("/api/mixer/anchor", body);
  }

  async mixerRotation(body) {
    return this._post("/api/mixer/rotation", body);
  }

  async mixerOpacity(body) {
    return this._post("/api/mixer/opacity", body);
  }

  async mixerKeyer(body) {
    return this._post("/api/mixer/keyer", body);
  }

  async mixerCommit(body) {
    return this._post("/api/mixer/commit", body);
  }

  async mixerClear(body) {
    return this._post("/api/mixer/clear", body);
  }

  async mixerEffect(body) {
    return this._post("/api/mixer/effect", body);
  }

  async pipOverlayApply(body) {
    return this._post("/api/pip-overlay/apply", body);
  }

  async pipOverlayUpdate(body) {
    return this._post("/api/pip-overlay/update", body);
  }

  async pipOverlayRemove(body) {
    return this._post("/api/pip-overlay/remove", body);
  }

  async multiviewApply(layoutId) {
    return this._post("/api/multiview/apply", { layoutId });
  }

  async setLogLevel(level) {
    return this._post("/api/log/level", { level });
  }

  async applyOsSettings() {
    return this._post("/api/settings/apply-os");
  }

  async toggleStreaming(enabled) {
    return this._post("/api/streaming/toggle", { enabled });
  }

  async setMonitoringSource(monitor) {
    return this._post("/api/audio/config", {
      audioRouting: { browserMonitor: monitor },
    });
  }

  async restartServer() {
    return this._post("/api/restart");
  }

  async getVariables() {
    return this._get("/api/variables");
  }

  async getVariablesBatch(categories = []) {
    const cats = Array.isArray(categories) ? categories.join(",") : categories;
    return this._get(
      `/api/variables/batch?categories=${encodeURIComponent(cats)}`,
    );
  }

  /** POST body `{ keys: string[] }` — exact keys only (avoids huge GET URLs). */
  async getVariablesByKeys(keys) {
    return this._post("/api/variables/batch", {
      keys: Array.isArray(keys) ? keys : [],
    });
  }

  async getVariableCustomLabels() {
    return this._get("/api/variables/custom");
  }

  async setVariableCustomLabels(labels) {
    return this._post("/api/variables/custom", { labels });
  }
}

export { HighAsCGApi };
