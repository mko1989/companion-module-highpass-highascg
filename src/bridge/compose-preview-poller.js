/**
 * HTTP fallback for compose-preview companion thumbs when the WebSocket bridge
 * is disconnected. When WS is up, HighAsCG pushes `variable_update` with the
 * PNG data URI — polling the same images again only doubles Companion/Stream Deck work.
 */

import {
  isComposePreviewButtonsEnabled,
  resolveComposePreviewChannels,
} from "../compose-preview-channels.js";
import { getBridgePort } from "../host-target.js";

/** Fallback poll interval when WS is down (not the live update cadence). */
const FALLBACK_POLL_MS = 1500;

/**
 * @param {string} variableId
 * @returns {{ ch: number, quad: string | null } | null}
 */
function parsePreviewVariableId(variableId) {
  const m = String(variableId || "").match(
    /^highascg_compose_preview_ch(\d+)_(image|quad_(tl|tr|bl|br))$/,
  );
  if (!m) return null;
  const ch = parseInt(m[1], 10);
  if (!Number.isFinite(ch) || ch < 1) return null;
  const quad = m[2].startsWith("quad_") ? m[3] : null;
  return { ch, quad };
}

class ComposePreviewPoller {
  /**
   * @param {import('../instance.js').HighAsCGInstance} instance
   */
  constructor(instance) {
    this.instance = instance;
    /** @type {Map<number, string>} channel -> raw base64 (no data: prefix) */
    this.png64ByChannel = new Map();
    /** @type {Map<number, string>} channel -> HTTP ETag */
    this._etagByChannel = new Map();
    /** @type {ReturnType<typeof setInterval> | null} */
    this._timer = null;
    /** @type {Map<number, Promise<void>>} */
    this._inFlight = new Map();
  }

  get baseUrl() {
    const host = this.instance.getActiveHost();
    return `http://${host}:${getBridgePort(this.instance.config)}`;
  }

  /**
   * Live preview variables arrive over WS; HTTP polling is fallback only.
   */
  _wsConnected() {
    return this.instance.bridge?.ws?.ws?.readyState === 1;
  }

  _enabled() {
    return (
      !!this.instance.config.highascg_enabled &&
      isComposePreviewButtonsEnabled(this.instance.config)
    );
  }

  _channels() {
    return resolveComposePreviewChannels(this.instance);
  }

  /**
   * @param {string} variableId
   * @returns {number | null}
   */
  channelFromVariableId(variableId) {
    return parsePreviewVariableId(variableId)?.ch ?? null;
  }

  /**
   * @param {number} channel
   * @returns {string | undefined}
   */
  getPng64(channel) {
    return this.png64ByChannel.get(channel);
  }

  /**
   * @param {number} channel
   * @param {{ force?: boolean }} [opts]
   */
  scheduleFetch(channel, opts = {}) {
    if (!this._enabled()) return;
    if (!opts.force && this._wsConnected()) return;
    const ch = parseInt(String(channel), 10);
    if (!Number.isFinite(ch) || ch < 1) return;
    if (this._inFlight.has(ch)) return;
    const run = this._fetchChannel(ch).finally(() => {
      if (this._inFlight.get(ch) === run) this._inFlight.delete(ch);
    });
    this._inFlight.set(ch, run);
  }

  /**
   * @param {number} channel
   * @returns {Promise<void>}
   */
  async waitForChannel(channel) {
    const ch = parseInt(String(channel), 10);
    if (!Number.isFinite(ch) || ch < 1) return;
    this.scheduleFetch(ch, { force: true });
    const pending = this._inFlight.get(ch);
    if (pending) await pending;
  }

  /**
   * @param {number} ch
   */
  async _fetchChannel(ch) {
    if (!this._enabled()) return;
    const url = `${this.baseUrl}/api/compose-preview/${ch}/companion.jpg`;
    try {
      /** @type {Record<string, string>} */
      const headers = { Accept: "image/png, image/jpeg, */*" };
      const etag = this._etagByChannel.get(ch);
      if (etag) headers["If-None-Match"] = etag;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers,
      });
      if (res.status === 304) return;
      if (!res.ok) return;

      const newEtag = res.headers.get("etag");
      if (newEtag) this._etagByChannel.set(ch, newEtag);

      const ct = res.headers.get("content-type") || "image/jpeg";
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 32) return;
      const b64 = buf.toString("base64");
      const prev = this.png64ByChannel.get(ch);
      if (prev === b64) return;

      this.png64ByChannel.set(ch, b64);
      const mime = ct.includes("png") ? "image/png" : "image/jpeg";
      const dataUri = `data:${mime};base64,${b64}`;
      const serverKey = `compose_preview_ch${ch}_image`;

      if (this.instance.bridge?.sync) {
        this.instance.updateVariablesFromBridge({ [serverKey]: dataUri });
      } else {
        this.instance.setVariableValues({
          [`highascg_${serverKey}`]: dataUri,
        });
      }
    } catch (e) {
      this.instance.log("debug", `compose preview fetch ch${ch}: ${e.message || e}`);
    }
  }

  start() {
    this.stop();
    if (!this._enabled()) return;
    for (const ch of this._channels()) {
      this.scheduleFetch(ch, { force: true });
    }
    this._timer = setInterval(() => {
      if (!this._enabled()) return;
      if (this._wsConnected()) return;
      for (const ch of this._channels()) this.scheduleFetch(ch);
    }, FALLBACK_POLL_MS);
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._inFlight.clear();
    this.png64ByChannel.clear();
    this._etagByChannel.clear();
  }
}

export { ComposePreviewPoller, parsePreviewVariableId };
