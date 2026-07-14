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
  }

  get baseUrl() {
    const host = this.instance.getActiveHost();
    return `http://${host}:${getBridgePort(this.instance.config)}`;
  }

  _wsConnected() {
    return this.instance.bridge?.ws?.ws?.readyState === 1;
  }

  _enabled() {
    return !!this.instance.config.highascg_enabled;
  }

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   */
  async _fetchStatus(ms) {
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
      this._applyStatus(data);
    } catch (e) {
      this.instance.log(
        "debug",
        `streaming-channel poller: ${e.message || e}`,
      );
    }
  }

  /**
   * @param {object} status
   */
  _applyStatus(status) {
    if (!status || typeof status !== "object") return;

    const vars = {};

    // RTMP status
    const rtmp = status.rtmp;
    if (rtmp) {
      vars.highascg_rtmp_state = rtmp.active ? "active" : "inactive";
      vars.highascg_rtmp_url = rtmp.url || "";
    }

    // Record status (simplified: show first active session or "inactive")
    const record = status.record;
    if (record && Array.isArray(record.sessions)) {
      const active = record.sessions.find((s) => s?.active);
      vars.highascg_record_state = active ? "recording" : "idle";
      vars.highascg_record_path = active?.path || "";
      vars.highascg_record_output_id = active?.outputId || "";
    } else {
      vars.highascg_record_state = "idle";
      vars.highascg_record_path = "";
      vars.highascg_record_output_id = "";
    }

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
