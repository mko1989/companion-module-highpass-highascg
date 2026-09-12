#!/usr/bin/env node
/**
 * Trace compose preview base64 from HighAsCG → Companion variables → button layers.
 * Run while HighAsCG + Companion are up: node scripts/trace-preview-base64-path.js
 */
import crypto from "crypto";

const HIGHASCG = process.env.HIGHASCG_URL || "http://127.0.0.1:4200";
const CHANNELS = [1, 2, 3];

function hashBody(dataUri) {
  const s = String(dataUri ?? "");
  const body = s.includes(",") ? s.slice(s.indexOf(",") + 1) : s;
  if (!body) return "(empty)";
  return crypto.createHash("sha256").update(body).digest("hex").slice(0, 12);
}

async function fetchJson(path) {
  const r = await fetch(`${HIGHASCG}${path}`, { signal: AbortSignal.timeout(5000) });
  return r.json();
}

async function fetchBytes(path) {
  const r = await fetch(`${HIGHASCG}${path}`, { signal: AbortSignal.timeout(5000) });
  const buf = Buffer.from(await r.arrayBuffer());
  return { buf, ct: r.headers.get("content-type") || "?" };
}

console.log("=== HighAsCG compose preview path ===\n");

const stats = await fetchJson("/api/compose-preview/stats").catch((e) => {
  console.error("HighAsCG unreachable:", e.message);
  process.exit(1);
});

console.log("Mode:", stats.mode, "| companionThumb:", stats.companionThumb?.enabled);
console.log("Channels:", stats.channels?.join(", "));

for (const ch of CHANNELS) {
  const meta = stats.companionThumb?.byChannel?.[ch];
  if (!meta) continue;
  console.log(`\n--- Channel ${ch} ---`);
  console.log("  Server variable key:", meta.variable);
  console.log("  Companion variable id:", `highascg_${meta.variable}`);
  console.log("  HTTP:", meta.url, `(${meta.jpegBytes || "?"} bytes PNG)`);
  if (meta.lastUpdateMs) {
    console.log("  Last push:", new Date(meta.lastUpdateMs).toISOString());
  }

  const { buf, ct } = await fetchBytes(meta.url);
  console.log("  HTTP fetch:", buf.length, "bytes", ct, "hash=", hashBody(`data:x;base64,${buf.toString("base64")}`));
}

const state = await fetchJson("/api/state");
const vars = state.variables || {};
console.log("\n--- WS/state variables (data URI prefix + hash) ---");
for (const ch of CHANNELS) {
  const key = `compose_preview_ch${ch}_image`;
  const v = vars[key];
  if (!v) {
    console.log(`  ${key}: (not set)`);
    continue;
  }
  const mime = String(v).slice(5, String(v).indexOf(";"));
  console.log(`  ${key}: len=${String(v).length} mime=${mime} hash=${hashBody(v)}`);
}

console.log(`
--- Companion button binding ---
  Compose channel buttons: $(HighAsCG:highascg_compose_preview_chN_image)
  Look buttons (on PGM/PRV): $(HighAsCG:highascg_look_air_frame_{slug})
  Module sends companion.hello on WS connect — server pushes only requested preview traffic
`);
