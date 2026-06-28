/**
 * Dedupe compose preview variable pushes (same image hash → skip).
 *
 * HighAsCG already rate-limits companion thumbs to the compose-preview tick;
 * do not add a second time throttle here or Stream Deck / web UI lag behind air.
 */

import crypto from "crypto";

const PREVIEW_SERVER_KEY_RE =
  /^compose_preview_ch\d+_(?:image|quad_(?:tl|tr|bl|br))$/;

class PreviewVariableGate {
  /** @type {Map<string, string>} */
  _lastHash = new Map();

  /**
   * @param {string} key
   */
  isPreviewServerKey(key) {
    return PREVIEW_SERVER_KEY_RE.test(String(key));
  }

  /**
   * @param {string} val
   * @returns {string}
   */
  _hash(val) {
    const s = String(val ?? "");
    if (!s) return "";
    const body = s.includes(",") ? s.slice(s.indexOf(",") + 1) : s;
    if (!body) return "";
    return crypto.createHash("sha256").update(body).digest("hex");
  }

  /**
   * Filter a batch of unprefixed HighAsCG variable keys (hash dedupe only).
   *
   * @param {Record<string, string>} incoming
   * @returns {Record<string, string>}
   */
  filterServerBatch(incoming) {
    /** @type {Record<string, string>} */
    const pass = {};
    for (const [key, val] of Object.entries(incoming || {})) {
      if (!this.isPreviewServerKey(key)) {
        pass[key] = val;
        continue;
      }
      const hash = this._hash(val);
      if (!hash) {
        this._lastHash.delete(key);
        pass[key] = val;
        continue;
      }
      if (hash === this._lastHash.get(key)) continue;
      this._lastHash.set(key, hash);
      pass[key] = val;
    }
    return pass;
  }

  reset() {
    this._lastHash.clear();
  }
}

export { PreviewVariableGate, PREVIEW_SERVER_KEY_RE };
