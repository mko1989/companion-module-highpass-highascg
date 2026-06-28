/**
 * @file quadrant-splitter.js
 * Split a compose-preview PNG data-URI into four quadrant data-URIs for Stream Deck buttons.
 *
 * Pure in-memory crop (pngjs) — no ffmpeg or temp files, so Companion's Node permission
 * sandbox does not need --allow-fs-write / child-process.
 */

import crypto from "crypto";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

/** @typedef {'tl' | 'tr' | 'bl' | 'br'} QuadrantId */

const QUADRANT_OFFSET = /** @type {const} */ ({
  tl: { x: 0, y: 0 },
  tr: { x: 0.5, y: 0 },
  bl: { x: 0, y: 0.5 },
  br: { x: 0.5, y: 0.5 },
});

/**
 * @param {string} dataUri
 * @returns {{ mime: string, buffer: Buffer } | null}
 */
function parseDataUri(dataUri) {
  const raw = String(dataUri || "").trim();
  if (!raw.startsWith("data:")) return null;
  const comma = raw.indexOf(",");
  if (comma < 0) return null;
  const header = raw.slice(0, comma);
  const body = raw.slice(comma + 1);
  if (!header.includes("base64")) return null;
  const mime = header.slice(5, header.indexOf(";"));
  try {
    const buffer = Buffer.from(body, "base64");
    if (buffer.length < 64) return null;
    return { mime, buffer };
  } catch {
    return null;
  }
}

/**
 * @param {Buffer} png
 * @returns {string}
 */
function pngToDataUri(png) {
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * @param {{ width: number, height: number, data: Buffer }} raster
 * @param {QuadrantId} quadrant
 * @returns {Buffer}
 */
function cropQuadrantRaster(raster, quadrant) {
  const w = raster.width;
  const h = raster.height;
  const qw = Math.max(1, Math.floor(w / 2));
  const qh = Math.max(1, Math.floor(h / 2));
  const off = QUADRANT_OFFSET[quadrant];
  const x = Math.floor(w * off.x);
  const y = Math.floor(h * off.y);
  const out = new PNG({ width: qw, height: qh });

  for (let row = 0; row < qh; row++) {
    for (let col = 0; col < qw; col++) {
      const srcIdx = ((y + row) * w + (x + col)) * 4;
      const dstIdx = (row * qw + col) * 4;
      out.data[dstIdx] = raster.data[srcIdx];
      out.data[dstIdx + 1] = raster.data[srcIdx + 1];
      out.data[dstIdx + 2] = raster.data[srcIdx + 2];
      out.data[dstIdx + 3] = raster.data[srcIdx + 3] ?? 255;
    }
  }

  return PNG.sync.write(out);
}

/**
 * @param {string} dataUri
 * @returns {{ width: number, height: number, data: Buffer } | null}
 */
function decodePreviewRaster(dataUri) {
  const parsed = parseDataUri(dataUri);
  if (!parsed) return null;

  if (parsed.mime.includes("png")) {
    try {
      const png = PNG.sync.read(parsed.buffer);
      if (!png?.width || !png?.height) return null;
      return { width: png.width, height: png.height, data: png.data };
    } catch {
      return null;
    }
  }

  if (parsed.mime.includes("jpeg") || parsed.mime.includes("jpg")) {
    try {
      const decoded = jpeg.decode(parsed.buffer, { useTArray: true });
      if (!decoded?.width || !decoded?.height) return null;
      return {
        width: decoded.width,
        height: decoded.height,
        data: Buffer.from(decoded.data),
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * @param {string} dataUri
 * @returns {Promise<Partial<Record<QuadrantId, string>>>}
 */
async function splitPreviewQuadrants(dataUri) {
  const raster = decodePreviewRaster(dataUri);
  if (!raster || raster.width < 2 || raster.height < 2) return {};

  /** @type {Partial<Record<QuadrantId, string>>} */
  const out = {};
  for (const quad of /** @type {QuadrantId[]} */ (["tl", "tr", "bl", "br"])) {
    try {
      const buf = cropQuadrantRaster(raster, quad);
      if (buf.length > 32) out[quad] = pngToDataUri(buf);
    } catch {
      /* skip quadrant */
    }
  }

  return out;
}

class ComposePreviewQuadrantSplit {
  /**
   * @param {{ log?: (level: string, msg: string) => void }} [opts]
   */
  constructor(opts = {}) {
    this._log = opts.log || (() => {});
    /** @type {Map<number, string>} */
    this._lastHashByChannel = new Map();
    /** @type {Map<number, Promise<Partial<Record<QuadrantId, string>>>>} */
    this._inFlight = new Map();
    /** @type {Map<number, Partial<Record<QuadrantId, string>>>} */
    this._cache = new Map();
    /** @type {Map<number, string>} */
    this._pendingUri = new Map();
    /** @type {Set<number>} */
    this._warnedDecode = new Set();
  }

  /**
   * @param {number} channel
   * @param {string} dataUri
   * @returns {Promise<Partial<Record<QuadrantId, string>> | null>}
   */
  async updateFromSourceImage(channel, dataUri) {
    const ch = parseInt(String(channel), 10);
    if (!Number.isFinite(ch) || ch < 1) return null;
    const raw = String(dataUri || "").trim();
    if (!raw) return this._cache.get(ch) || null;

    const hash = crypto.createHash("sha1").update(raw).digest("hex");
    if (hash === this._lastHashByChannel.get(ch)) {
      return this._cache.get(ch) || null;
    }

    this._pendingUri.set(ch, raw);
    const prev = this._inFlight.get(ch);
    if (prev) return prev;

    const run = this._drainChannel(ch).finally(() => {
      if (this._inFlight.get(ch) === run) this._inFlight.delete(ch);
    });
    this._inFlight.set(ch, run);
    return run;
  }

  /**
   * @param {number} ch
   */
  async _drainChannel(ch) {
    let latest = {};
    while (this._pendingUri.has(ch)) {
      const raw = this._pendingUri.get(ch) || "";
      this._pendingUri.delete(ch);
      if (!raw) continue;

      const hash = crypto.createHash("sha1").update(raw).digest("hex");
      if (hash === this._lastHashByChannel.get(ch)) {
        latest = this._cache.get(ch) || latest;
        continue;
      }

      try {
        const quads = await splitPreviewQuadrants(raw);
        const count = Object.keys(quads).length;
        if (count === 0) {
          if (!this._warnedDecode.has(ch)) {
            this._warnedDecode.add(ch);
            this._log(
              "warn",
              `[preview-split] ch${ch}: could not decode preview for quadrant split`,
            );
          }
          continue;
        }
        this._lastHashByChannel.set(ch, hash);
        this._cache.set(ch, quads);
        latest = quads;
      } catch (err) {
        this._log("debug", `[preview-split] ch${ch}: ${err?.message || err}`);
      }
    }
    return latest;
  }

  /**
   * @param {number} channel
   * @returns {Partial<Record<QuadrantId, string>>}
   */
  getCached(channel) {
    return this._cache.get(parseInt(String(channel), 10)) || {};
  }

  /**
   * @param {number} channel
   * @param {QuadrantId} quadrant
   * @returns {string | undefined}
   */
  getCachedQuadrantPng64(channel, quadrant) {
    const dataUri = this.getCached(channel)[quadrant];
    if (!dataUri) return undefined;
    const comma = String(dataUri).indexOf(",");
    return comma >= 0 ? String(dataUri).slice(comma + 1).trim() : undefined;
  }

  reset() {
    this._cache.clear();
    this._lastHashByChannel.clear();
    this._inFlight.clear();
    this._pendingUri.clear();
    this._warnedDecode.clear();
  }
}

/**
 * Server-side variable keys for quadrant images (Companion adds highascg_ prefix).
 * @param {number} channel
 * @param {QuadrantId} quadrant
 */
function quadrantVariableKey(channel, quadrant) {
  return `compose_preview_ch${channel}_quad_${quadrant}`;
}

export {
  QUADRANT_OFFSET,
  parseDataUri,
  splitPreviewQuadrants,
  ComposePreviewQuadrantSplit,
  quadrantVariableKey,
};
