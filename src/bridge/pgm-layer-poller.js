/**
 * @file pgm-layer-poller.js
 * PGM layer readback (HighAsCG WO-803): polls GET /api/screens/pgm-layer and redraws the readback buttons only when
 * what they show changed (remaining second, bar pixel, paused, cleared) — at most once per poll, never per frame.
 */

import { getBridgePort } from "../host-target.js";
import {
  PGM_READBACK_FEEDBACK_ID,
  pgmLayerVariableValues,
  readbackView,
} from "../pgm-layers.js";

/** Twice a second, so every remaining second is shown once (a 1 s poll would skip or repeat one on jitter). */
const POLL_MS = 500;

/** The change signature: exactly what the buttons and variables show. */
export function pgmLayerSignature(screens) {
  const list = Array.isArray(screens) ? screens : [];
  return JSON.stringify(
    list.map((e) => [e?.screen, e?.label, e?.clip, readbackView(e)]),
  );
}

class PgmLayerPoller {
  /** @param {import('../instance.js').HighAsCGInstance} instance */
  constructor(instance) {
    this.instance = instance;
    this._pollTimer = null;
    this._inFlight = null;
    this._lastSig = "";
    this._lastCount = -1;
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
      const res = await fetch(`${this.baseUrl}/api/screens/pgm-layer`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.ok || !Array.isArray(data.screens)) return;
      this.ingest(data.screens);
    } catch (e) {
      // Server unreachable: the buttons fall back to their cleared state rather than freezing a countdown.
      this.ingest([]);
      this.instance.log("debug", `pgm-layer poller: ${e.message || e}`);
    }
  }

  /** Store the screens and redraw only on change. Public so tests can drive it without HTTP. */
  ingest(screens) {
    this.instance._pgmLayers = screens;
    if (screens.length && screens.length !== this._lastCount) {
      // The screen dropdown on the feedback follows the screen set.
      if (this._lastCount !== -1) this.instance.updateFeedbacks?.();
      this._lastCount = screens.length;
    }
    const sig = pgmLayerSignature(screens);
    if (sig === this._lastSig) return false;
    this._lastSig = sig;
    this.instance.setVariableValues(pgmLayerVariableValues(screens));
    this.instance.checkFeedbacks(PGM_READBACK_FEEDBACK_ID);
    return true;
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

export { PgmLayerPoller, POLL_MS };
