# HighPass HighAsCG

This module connects **Bitfocus Companion** to:

1. **CasparCG** over **TCP/AMCP** — low-latency playout commands (PLAY, STOP, CLEAR, raw AMCP).
2. **HighAsCG** (standalone app) over **HTTP + WebSocket** — scene take, timelines, multiview, mixer-style volume via `/api`, and live **variables** synced from the app.

Caspar and HighAsCG run on the **same machine**, so one **Box Host** covers both connections.

## Configuration

- **Box Host** — IP of the HighAsCG/Caspar box (default `127.0.0.1`).
- **AMCP Port** — Caspar server port (default `5250`).
- **HighAsCG HTTP Port** — Node bridge port (default `4200`).
- **Use HighAsCG Bridge** — turn off if you only need direct AMCP.
- **Compose preview on Stream Deck buttons** — when enabled (default), live JPEG compose previews update button images over the WebSocket bridge (~0.5–1.5 Mbps per active channel). Disable on remote Companion hosts or when you only need look/scene actions and text labels without live thumbnails. Look recall buttons still show PGM/PRV borders and names when preview is off; on-air live video on look buttons requires this option on.

Compose preview presets and variables are generated only for **Caspar channels in your HighAsCG channel map** (PGM + PRV outputs), not a fixed ch1–8 list.

Quadrant presets (2×2 per channel) include seam-safe corner badges: **PGM** or **PRV** bottom-left, **SCR n** bottom-right on the matching cells.

### Hot backup

Pair leader and backup in **HighAsCG Device View** first. Then in Companion:

- **Enable Hot Backup** — failover when the main box is unreachable.
- **Backup Box Host** — IP of the backup machine (same AMCP + HTTP ports).

While main is up, all actions go to main only. If main disconnects, Companion automatically switches to the backup host and switches back when main returns.

Variables: `highascg_connection_target` (`main` / `backup`), `highascg_active_host`.

## Variables

When the bridge is enabled, HighAsCG internal variables are exposed as Companion variables with the prefix `highascg_` (for example `highascg_app_uptime`).

## Actions

- **Direct TCP:** Play Clip, Stop Layer, Clear, Raw AMCP.
- **Bridge:** Scene Take, Timeline Play/Stop, Audio Volume (via HighAsCG API), Apply Multiview Layout.

Ensure the HighAsCG app is running and reachable before expecting bridge actions or variables to work.

## Installing a packaged build

From the module folder:

```bash
yarn install
yarn package
```

This writes **`highpass-highascg-<version>.tgz`** (for example `highpass-highascg-1.0.0.tgz`) in the project root.

In Companion: **Connections → Add connection → Upload local module** (or drag the `.tgz` onto the connections list, depending on your Companion version). Pick the file, then add an instance and configure the box host.

Use `yarn package:dev` for an unminified build while debugging.
