#!/usr/bin/env node
/**
 * WO-372 — make a dev build self-identifying.
 *
 * `companion-module-build` copies the version straight out of package.json, so a dev package and
 * the installed package both declared `highpass-highascg@1.0.4`. Companion's version picker lists
 * VERSIONS of a module id: two copies claiming the same one collapse to a single entry, which is
 * why the owner saw "no dev to choose" (checklist27 item 40) and why an edit → package → restart
 * loop could silently load either copy depending on scan order.
 *
 * This rewrites the PACKAGED manifest only (pkg/<id>/companion/manifest.json) — source
 * package.json and companion/manifest.json are never touched, so nothing dev-only is committable
 * by accident.
 *
 * Version form: <next patch>-dev.d<UTC yyyymmdd>t<hhmm>, e.g. 1.0.5-dev.d20260728t1512.
 *   - a leading-letter identifier, because semver forbids leading zeros in NUMERIC prerelease
 *     identifiers and a 09xx timestamp would be invalid;
 *   - next-patch rather than same-patch so it sorts ABOVE the installed release (a `1.0.4-dev.x`
 *     prerelease sorts below `1.0.4` and would read as older than what it is testing);
 *   - verified accepted by validateManifest from @companion-module/base/manifest — the same
 *     validator the build tool runs.
 *
 * Usage: node scripts/stamp-dev-manifest.js [--id highpass-highascg]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function argValue(flag, fallback) {
	const i = process.argv.indexOf(flag)
	return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function devVersion(release) {
	const [maj, min, patch] = String(release)
		.split('-')[0]
		.split('.')
		.map((n) => parseInt(n, 10) || 0)
	const d = new Date()
	const p = (n, w = 2) => String(n).padStart(w, '0')
	const stamp = `d${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}t${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
	return `${maj}.${min}.${patch + 1}-dev.${stamp}`
}

const id = argValue('--id', 'highpass-highascg')
const manifestPath = path.join(REPO, 'pkg', id, 'companion', 'manifest.json')

if (!fs.existsSync(manifestPath)) {
	console.error(`[stamp-dev-manifest] no packaged manifest at ${manifestPath} — run the build first`)
	process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const before = manifest.version
manifest.version = devVersion(before)
manifest.isPrerelease = true

const { validateManifest } = await import('@companion-module/base/manifest')
try {
	validateManifest(manifest, false)
} catch (e) {
	console.error('[stamp-dev-manifest] refusing to write an invalid manifest:', e?.message || e)
	process.exit(1)
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest))
console.log(`[stamp-dev-manifest] ${id}: ${before} → ${manifest.version} (isPrerelease: true)`)
console.log('[stamp-dev-manifest] restart Companion, then pick this version on the HighAsCG connection.')
