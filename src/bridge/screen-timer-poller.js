/**
 * @file screen-timer-poller.js
 * Keeps the screen-timer variables live: polls GET /api/timers/list for the authoritative
 * records, then ticks the readout locally between polls (the display is pure math over
 * `{lastCmd, cmdAt, config}` — see src/screen-timers.js), so a running timer counts down on a
 * button 4×/s without 4 requests a second.
 */

import { getBridgePort } from "../host-target.js";
import { screenTimerVariableValues, sortTimers } from "../screen-timers.js";

/** How often the record list is re-read (config/transport changes made elsewhere). */
const POLL_MS = 2000;
/** How often the variables are recomputed from the cached records. */
const TICK_MS = 250;

class ScreenTimerPoller {
  /** @param {import('../instance.js').HighAsCGInstance} instance */
  constructor(instance) {
    this.instance = instance;
    this._pollTimer = null;
    this._tickTimer = null;
    this._inFlight = null;
    /** Signature of the last published values, so an idle timer writes nothing. */
    this._lastSig = "";
    /** Server clock minus this process's clock, remeasured every poll — see screen-timers.js. */
    this._clockOffsetMs = 0;
  }

  get baseUrl() {
    const host = this.instance.getActiveHost();
    return `http://${host}:${getBridgePort(this.instance.config)}`;
  }

  _enabled() {
    return true;
  }

  async fetchNow() {
    if (!this._enabled()) return;
    if (this._inFlight) return this._inFlight;
    this._inFlight = this._doFetch().finally(() => {
      this._inFlight = null;
    });
    return this._inFlight;
  }

  async _doFetch() {
    try {
      const res = await fetch(`${this.baseUrl}/api/timers/list`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const localNowMs = Date.now();
      if (!data?.ok || !Array.isArray(data.timers)) return;

      // Companion may run on a different machine than the server (e.g. a Raspberry Pi) with
      // its own clock. Re-measuring this every poll means only clock drift BETWEEN polls can
      // skew the display, not whether the two machines' clocks agree in absolute terms.
      if (Number.isFinite(data.serverNowMs)) {
        this._clockOffsetMs = data.serverNowMs - localNowMs;
      }

      const prevIds = (this.instance._screenTimers || [])
        .map((t) => t.timerId)
        .join(",");
      this.instance._screenTimers = sortTimers(data.timers);
      const nextIds = this.instance._screenTimers
        .map((t) => t.timerId)
        .join(",");
      // The action dropdowns list the timers by name, the variable definitions are one block per
      // timer, and the presets are one button set per timer — all rebuilt when the set changes.
      if (prevIds !== nextIds) {
        this.instance.updateActions();
        this.instance.updateVariables();
        this.instance.updatePresets();
        this._lastSig = ""; // definitions changed — force a value publish for the new ids
      }
      this._publish();
    } catch (e) {
      this.instance.log("debug", `screen-timer poller: ${e.message || e}`);
    }
  }

  _publish() {
    const vars = screenTimerVariableValues(
      this.instance._screenTimers || [],
      Date.now(),
      this._clockOffsetMs,
    );
    const sig = JSON.stringify(vars);
    if (sig === this._lastSig) return;
    this._lastSig = sig;
    this.instance.setVariableValues(vars);
  }

  start() {
    this.stop();
    if (!this._enabled()) return;
    this._pollTimer = setInterval(() => void this.fetchNow(), POLL_MS);
    this._tickTimer = setInterval(() => this._publish(), TICK_MS);
    if (this._pollTimer.unref) this._pollTimer.unref();
    if (this._tickTimer.unref) this._tickTimer.unref();
    void this.fetchNow();
  }

  stop() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
  }
}

export { ScreenTimerPoller };
