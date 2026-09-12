/**
 * @file streaming-channel-poller.js
 * HTTP poller for streaming channel status (RTMP/record state and active outputs).
 * Polls GET /api/streaming-channel when WS is down; WS broadcasts status updates when up.
 */

import { getBridgePort } from "../host-target.js";

/** Fallback poll interval when WS is down. */
const FALLBACK_POLL_MS = 2000;

class StreamingChannelPoller {
  /**
   * @param {import('../instance.js').HighAsCGInstance} instance
   */
  constructor(instance) {
    this.instance = instance;
    /** @type {ReturnType<typeof setInterval> | null} */
    this._timer = null;
    /** @type {Promise<void> | null} */
    this._inFlight = null;
    /** @type {string} — configured-output catalog signature (rebuild gates on change) */
    this._outputsSig = "";
  }

  get baseUrl() {
    const host = this.instance.getActiveHost();
    return `http://${host}:${getBridgePort(this.instance.config)}`;
  }

  _wsConnected() {
    return this.instance.bridge?.ws?.ws?.readyState === 1;
  }

  _enabled() {
    return true;
  }

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   */
  async _fetchStatus(_ms) {
    if (!this._enabled() || this._wsConnected()) return;
    if (this._inFlight) return;

    this._inFlight = this._doFetch().finally(() => {
      if (this._inFlight) this._inFlight = null;
    });
    await this._inFlight;
  }

  /**
   * @returns {Promise<void>}
   */
  async _doFetch() {
    if (!this._enabled()) return;
    const url = `${this.baseUrl}/api/streaming-channel`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;

      const data = await res.json();
      this.applyStatus(data);
    } catch (e) {
      this.instance.log("debug", `streaming-channel poller: ${e.message || e}`);
    }
  }

  /**
   * Apply a streaming-channel status payload (from the HTTP poll OR the WS
   * `streaming_channel` broadcast — ws-client.js calls this directly, WO-395).
   * @param {object} status
   */
  applyStatus(status) {
    if (!status || typeof status !== "object") return;

    this.instance._streamingChannelStatus = status;

    // Configured-output catalog (WO-395): actions/feedbacks/presets enumerate the outputs
    // that are actually set on the box — rebuild them when the catalog changes.
    const outputs =
      status.outputs && typeof status.outputs === "object"
        ? {
            stream: Array.isArray(status.outputs.stream)
              ? status.outputs.stream
              : [],
            record: Array.isArray(status.outputs.record)
              ? status.outputs.record
              : [],
          }
        : { stream: [], record: [] };
    const sig = JSON.stringify([
      outputs.stream.map((o) => [o?.id, o?.label, o?.enabled !== false]),
      outputs.record.map((o) => [o?.id, o?.label, o?.enabled !== false]),
    ]);
    if (sig !== this._outputsSig) {
      this._outputsSig = sig;
      this.instance._streamingOutputs = outputs;
      this.instance.updateActions();
      this.instance.updateFeedbacks();
      this.instance.updatePresets();
    }

    const vars = {};

    // RTMP status
    const rtmp = status.rtmp;
    if (rtmp) {
      vars.highascg_rtmp_state = rtmp.active ? "active" : "inactive";
      vars.highascg_rtmp_url = rtmp.url || "";
    }

    // Record status. The server's `sessions` array only lists ACTIVE recordings and its
    // entries carry no `active` flag — `record.active`/`activeOutputs` are the truth
    // (the old `sessions.find(s => s.active)` was always empty → state stuck on "idle").
    const record = status.record;
    const activeSession = record?.active
      ? (Array.isArray(record.sessions) && record.sessions[0]) || record
      : null;
    vars.highascg_record_state = activeSession ? "recording" : "idle";
    vars.highascg_record_path = activeSession?.path || "";
    vars.highascg_record_output_id =
      activeSession?.outputId || record?.activeOutputs?.[0] || "";

    if (this.instance.bridge?.sync) {
      this.instance.updateVariablesFromBridge(vars);
    } else {
      this.instance.setVariableValues(vars);
    }

    // Trigger feedback checks for streaming_active and recording_active
    this.instance.checkFeedbacks("streaming_active", "recording_active");
  }

  start() {
    this.stop();
    if (!this._enabled()) return;
    this._timer = setInterval(() => {
      void this._fetchStatus(FALLBACK_POLL_MS);
    }, FALLBACK_POLL_MS);
    if (this._timer.unref) this._timer.unref();
    // Fetch immediately on start
    void this._fetchStatus(0);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

export { StreamingChannelPoller };
