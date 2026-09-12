/**
 * Per-look on-air still frames for Stream Deck look buttons.
 *
 * HighAsCG server pushes `look_air_frame_{slug}` when a look is on PGM/PRV
 * (see highascg/src/companion-bridge/look-air-frames.js). Look button presets
 * bind to `highascg_look_air_frame_{slug}` — only on-air looks receive updates.
 *
 * This cache is retained for legacy client-side fallback only; server push is primary.
 */

import crypto from "crypto";
import { lookIdSlug } from "./look-vars.js";
import { resolveLookAirState } from "./look-air-state.js";

/** Hash dedupe only — compose preview tick sets the update cadence. */
const AIR_FRAME_REFRESH_MS = 0;

/**
 * @param {string} lookId
 * @returns {string}
 */
export function lookAirFrameVariableId(lookId) {
  return `highascg_look_air_frame_${lookIdSlug(lookId) || "unknown"}`;
}

/**
 * @param {string} dataUri
 * @returns {string}
 */
function hashDataUri(dataUri) {
  const s = String(dataUri ?? "");
  if (!s) return "";
  const body = s.includes(",") ? s.slice(s.indexOf(",") + 1) : s;
  if (!body) return "";
  return crypto.createHash("sha256").update(body).digest("hex");
}

class LookAirFrameCache {
  /**
   * @param {import('./instance.js').HighAsCGInstance} instance
   */
  constructor(instance) {
    this.instance = instance;
    /** @type {Map<string, { channel: number, hash: string, lastMs: number }>} */
    this._onAir = new Map();
  }

  /**
   * @param {string} lookId
   * @param {string} dataUri
   * @param {{ force?: boolean }} [opts]
   */
  _pushLookFrame(lookId, dataUri, opts = {}) {
    const id = String(lookId ?? "").trim();
    if (!id) return;
    const uri = String(dataUri ?? "");
    const hash = hashDataUri(uri);
    const prev = this._onAir.get(id);
    const now = Date.now();
    if (!opts.force && prev && hash && hash === prev.hash) return;
    if (
      AIR_FRAME_REFRESH_MS > 0 &&
      !opts.force &&
      prev &&
      now - prev.lastMs < AIR_FRAME_REFRESH_MS
    ) {
      return;
    }

    this._onAir.set(id, {
      channel: prev?.channel ?? 0,
      hash,
      lastMs: now,
    });

    this.instance.setVariableValues({
      [lookAirFrameVariableId(id)]: uri,
    });
  }

  /**
   * @param {string} lookId
   */
  _clearLookFrame(lookId) {
    const id = String(lookId ?? "").trim();
    if (!id) return;
    if (!this._onAir.has(id)) return;
    this._onAir.delete(id);
    this.instance.setVariableValues({
      [lookAirFrameVariableId(id)]: "",
    });
  }

  /**
   * Reconcile on-air looks after scene.live changes — snap or clear per look.
   *
   * @param {Record<string, { sceneId?: string }> | null | undefined} prevLive
   * @param {Record<string, { sceneId?: string }> | null | undefined} nextLive
   */
  syncFromSceneLive(prevLive, nextLive) {
    const instance = this.instance;
    const map = instance._channelMap;
    const screenCount = Math.max(
      1,
      Number(map?.screenCount) || map?.programChannels?.length || 1,
    );

    /** @type {Set<string>} */
    const prevOnAir = new Set();
    /** @type {Set<string>} */
    const nextOnAir = new Set();

    for (let screenIdx = 0; screenIdx < screenCount; screenIdx += 1) {
      for (const live of [prevLive, nextLive]) {
        const set = live === prevLive ? prevOnAir : nextOnAir;
        const pgmCh = map?.programChannels?.[screenIdx];
        if (pgmCh != null) {
          const sid = live?.[String(pgmCh)]?.sceneId;
          if (sid) set.add(String(sid).trim());
        }
        const prvCh = map?.previewChannels?.[screenIdx];
        if (prvCh != null && Number(prvCh) > 0) {
          const sid = live?.[String(prvCh)]?.sceneId;
          if (sid) set.add(String(sid).trim());
        }
      }
    }

    for (const lookId of prevOnAir) {
      if (!nextOnAir.has(lookId)) {
        this._clearLookFrame(lookId);
      }
    }

    for (const lookId of nextOnAir) {
      if (prevOnAir.has(lookId)) continue;
      for (let screenIdx = 0; screenIdx < screenCount; screenIdx += 1) {
        const state = resolveLookAirState(instance, lookId, screenIdx);
        if (!state.onPgm && !state.onPrv) continue;
        const ch = state.previewChannel;
        if (ch == null) continue;
        const uri = instance.getVariableValue(
          `highascg_compose_preview_ch${ch}_image`,
        );
        if (uri) {
          this._onAir.set(lookId, {
            channel: ch,
            hash: hashDataUri(String(uri)),
            lastMs: Date.now(),
          });
          this._pushLookFrame(lookId, String(uri), { force: true });
        }
        break;
      }
    }
  }

  /**
   * Throttled refresh for looks currently on air that use this channel preview.
   *
   * @param {number} channel
   * @param {string} dataUri
   */
  onChannelPreview(channel, dataUri) {
    const ch = parseInt(String(channel), 10);
    const uri = String(dataUri ?? "");
    if (!Number.isFinite(ch) || ch < 1 || !uri) return;

    const instance = this.instance;
    const map = instance._channelMap;
    const screenCount = Math.max(
      1,
      Number(map?.screenCount) || map?.programChannels?.length || 1,
    );

    /** @type {Set<string>} */
    const seen = new Set();
    for (let screenIdx = 0; screenIdx < screenCount; screenIdx += 1) {
      const pgmCh = map?.programChannels?.[screenIdx];
      const prvCh = map?.previewChannels?.[screenIdx];
      for (const [busCh, isPgm] of [
        [pgmCh, true],
        [prvCh, false],
      ]) {
        if (busCh == null || Number(busCh) !== ch) continue;
        const entry =
          instance._sceneLive?.[String(busCh)];
        const lookId =
          entry?.sceneId != null ? String(entry.sceneId).trim() : "";
        if (!lookId || seen.has(lookId)) continue;
        if (isPgm) {
          seen.add(lookId);
          this._onAir.set(lookId, {
            channel: ch,
            hash: this._onAir.get(lookId)?.hash ?? "",
            lastMs: this._onAir.get(lookId)?.lastMs ?? 0,
          });
          this._pushLookFrame(lookId, uri);
          continue;
        }
        const pgmChForScreen = map?.programChannels?.[screenIdx];
        if (pgmChForScreen != null) {
          const pgmSid =
            instance._sceneLive?.[String(pgmChForScreen)]?.sceneId;
          if (pgmSid != null && String(pgmSid).trim() === lookId) continue;
        }
        seen.add(lookId);
        this._onAir.set(lookId, {
          channel: ch,
          hash: this._onAir.get(lookId)?.hash ?? "",
          lastMs: this._onAir.get(lookId)?.lastMs ?? 0,
        });
        this._pushLookFrame(lookId, uri);
      }
    }
  }

  reset() {
    for (const lookId of [...this._onAir.keys()]) {
      this._clearLookFrame(lookId);
    }
    this._onAir.clear();
  }
}

export { LookAirFrameCache, AIR_FRAME_REFRESH_MS };
