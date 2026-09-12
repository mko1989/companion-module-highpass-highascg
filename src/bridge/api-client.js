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
    return this._get(`/api/timelines/${encodeURIComponent(timelineId)}/state`);
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

  /**
   * WO-572 (HighAsCG) — stop whichever audio-only look is live on a channel, leaving that
   * channel's normal video look completely untouched (mirrors the web UI's mixer Stop button).
   * @param {number} channel
   */
  async stopAudioOnlyLook(channel) {
    return this._post("/api/scene/audio-only/stop", { channel });
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

  async setMonitoringSource(monitor) {
    return this._post("/api/audio/config", {
      audioRouting: { browserMonitor: monitor },
    });
  }

  /** Renew DHCP / reconnect wired NIC (passwordless sudo on playout host). */
  async resetNetwork(iface) {
    const body = iface ? { interface: String(iface) } : {};
    return this._post("/api/system/network/reset", body);
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

  /**
   * POST /api/amcp/raw — one raw AMCP line, sent through the app (normalized, tracked,
   * failover-aware). The module's only AMCP surface since WO-394.
   * @param {string} cmd
   */
  async amcpRaw(cmd) {
    return this._post("/api/amcp/raw", { cmd: String(cmd) });
  }

  /** GET /api/streaming-channel — full status (RTMP active, record sessions, etc.). */
  async getStreamingChannelStatus() {
    return this._get("/api/streaming-channel");
  }

  /**
   * POST /api/streaming-channel/rtmp — start or stop RTMP streaming.
   * @param {object} opts
   * @param {'start'|'stop'} opts.action
   * @param {string} [opts.rtmpServerUrl] — required for 'start'
   * @param {string} [opts.streamKey] — required for 'start'
   * @param {string} [opts.quality] — optional, e.g. 'medium'
   * @param {string} [opts.videoCodec] — optional
   * @param {number} [opts.videoBitrateKbps] — optional
   * @param {string} [opts.encoderPreset] — optional
   * @param {string} [opts.audioCodec] — optional
   * @param {number} [opts.audioBitrateKbps] — optional
   * @param {string} [opts.outputId] — optional output configuration id
   */
  async rtmpStreaming(opts = {}) {
    const body = {
      action: opts.action === "stop" ? "stop" : "start",
    };
    if (opts.rtmpServerUrl != null)
      body.rtmpServerUrl = String(opts.rtmpServerUrl);
    if (opts.streamKey != null) body.streamKey = String(opts.streamKey);
    if (opts.quality != null) body.quality = String(opts.quality);
    if (opts.videoCodec != null) body.videoCodec = String(opts.videoCodec);
    if (opts.videoBitrateKbps != null)
      body.videoBitrateKbps = Number(opts.videoBitrateKbps);
    if (opts.encoderPreset != null)
      body.encoderPreset = String(opts.encoderPreset);
    if (opts.audioCodec != null) body.audioCodec = String(opts.audioCodec);
    if (opts.audioBitrateKbps != null)
      body.audioBitrateKbps = Number(opts.audioBitrateKbps);
    if (opts.outputId != null) body.outputId = String(opts.outputId);
    return this._post("/api/streaming-channel/rtmp", body);
  }

  /**
   * POST /api/streaming-channel/record — start or stop recording.
   * @param {object} opts
   * @param {'start'|'stop'} opts.action
   * @param {string} [opts.outputId] — optional output configuration id
   * @param {number} [opts.crf] — optional quality (18-51, default 26)
   * @param {string} [opts.videoCodec] — optional
   * @param {number} [opts.videoBitrateKbps] — optional
   * @param {string} [opts.encoderPreset] — optional
   * @param {string} [opts.audioCodec] — optional
   * @param {number} [opts.audioBitrateKbps] — optional
   */
  async recordStreaming(opts = {}) {
    const body = {
      action: opts.action === "stop" ? "stop" : "start",
    };
    if (opts.outputId != null) body.outputId = String(opts.outputId);
    if (opts.crf != null) body.crf = Number(opts.crf);
    if (opts.videoCodec != null) body.videoCodec = String(opts.videoCodec);
    if (opts.videoBitrateKbps != null)
      body.videoBitrateKbps = Number(opts.videoBitrateKbps);
    if (opts.encoderPreset != null)
      body.encoderPreset = String(opts.encoderPreset);
    if (opts.audioCodec != null) body.audioCodec = String(opts.audioCodec);
    if (opts.audioBitrateKbps != null)
      body.audioBitrateKbps = Number(opts.audioBitrateKbps);
    return this._post("/api/streaming-channel/record", body);
  }

  /**
   * POST /api/timelines/:id/take — direct timeline take with optional sendTo routing.
   * @param {string} id — timeline id
   * @param {object} opts
   * @param {object} [opts.sendTo] — optional sendTo routing (preview, program, screenIdx)
   */
  async timelineTake(id, opts = {}) {
    const body = {};
    if (opts.sendTo && typeof opts.sendTo === "object") {
      body.sendTo = opts.sendTo;
    }
    return this._post(`/api/timelines/${encodeURIComponent(id)}/take`, body);
  }

  /**
   * POST /api/timelines/:id/sendto — set timeline sendTo routing.
   * @param {string} id — timeline id
   * @param {object} opts
   * @param {boolean} [opts.preview] — send to preview
   * @param {boolean} [opts.program] — send to program
   * @param {number} [opts.screenIdx] — screen index
   */
  async timelineSendTo(id, opts = {}) {
    const body = {};
    if (opts.preview != null) body.preview = !!opts.preview;
    if (opts.program != null) body.program = !!opts.program;
    if (opts.screenIdx != null) body.screenIdx = Number(opts.screenIdx);
    return this._post(`/api/timelines/${encodeURIComponent(id)}/sendto`, body);
  }

  /**
   * POST /api/countdown/:action — control countdown template.
   * @param {string} action — 'start', 'pause', 'reset', 'set', or 'update'
   * @param {object} opts
   * @param {number} [opts.channel] — CasparCG channel (routing)
   * @param {number} [opts.layer] — logical layer number (routing)
   * @param {number} [opts.layerNumber] — alias for layer (routing)
   * @param {string|object} [opts.rest] — remaining config properties for 'set'/'update'
   */
  async countdownControl(action, opts = {}) {
    const body = { ...opts };
    return this._post(`/api/countdown/${encodeURIComponent(action)}`, body);
  }

  /**
   * GET /api/countdown/list — enumerate countdown template layers.
   */
  async getCountdownList() {
    return this._get("/api/countdown/list");
  }

  /* ---- Screen timers (WO-210 registry: /api/timers/*) -------------------------------
   * These are the timers the HighAsCG web UI owns in its Timers dock and screen-timer
   * Inspector — assigned to screens, one CG layer each in the 980-989 band. Distinct from
   * the older channel/layer `countdown*` calls above. */

  /** GET /api/timers/list — every assigned timer with its config, runtime and screens. */
  async getScreenTimers() {
    return this._get("/api/timers/list");
  }

  /**
   * POST /api/timers/cmd — transport, fanned out by the server to every assigned screen.
   * @param {string} timerId
   * @param {'start'|'pause'|'reset'} cmd
   */
  async screenTimerCmd(timerId, cmd) {
    return this._post("/api/timers/cmd", { timerId, cmd });
  }

  /**
   * POST /api/timers/visible — show/hide on one screen; `fadeFrames > 0` ramps the opacity.
   * @param {{ timerId: string, screenIdx: number, visible: boolean, fadeFrames?: number, opacity?: number }} body
   */
  async screenTimerVisible(body) {
    return this._post("/api/timers/visible", body);
  }

  /**
   * POST /api/timers/assign — re-assigning a timer to a screen it already occupies merges
   * `config` and emits the CG UPDATE. This is how the time is set.
   * @param {{ timerId: string, screenIdx: number, config?: object, name?: string }} body
   */
  async screenTimerAssign(body) {
    return this._post("/api/timers/assign", body);
  }
}

export { HighAsCGApi };
