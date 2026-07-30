# Companion Module: HighPass HighAsCG

This module connects **Bitfocus Companion** to a **HighAsCG** playout box over **HTTP +
WebSocket**: looks/scene take, timelines, multiview, stream/record outputs, screen timers,
mixer-style volume via `/api`, and live **variables** synced from the app.

A **Raw AMCP Command** action remains as an escape hatch — it is sent through the app
(`POST /api/amcp/raw`), not a direct Caspar socket (WO-394).

## Installation

The packaged version of this module is installed via:
```bash
cd /home/casparcg/highascg
./tools/eggs/companion/install-companion-module.sh
```

This builds the module, installs it to Companion's modules directory, and updates any pinned version IDs in Companion's database.

## Configuration

- **Box Host** — IP of the HighAsCG box (default `127.0.0.1`)
- **HighAsCG HTTP Port** — app HTTP/WS port (default `4200`)
- **Compose preview on Stream Deck buttons** — when enabled (default), live JPEG compose previews update button images over the WebSocket bridge (~0.5–1.5 Mbps per active channel). Disable on remote Companion hosts or when you only need look/scene actions and text labels without live thumbnails. Look recall buttons still show PGM/PRV borders and names when preview is off; on-air live video on look buttons requires this option on

Compose preview presets and variables are generated only for **CasparCG channels in your HighAsCG channel map** (PGM + PRV outputs), not a fixed ch1–8 list.

Quadrant presets (2×2 per channel) include seam-safe corner badges: **PGM** or **PRV** bottom-left, **SCR n** bottom-right on the matching cells.

### Hot Backup

Pair leader and backup in **HighAsCG Device View** first. Then in Companion:

- **Enable Hot Backup** — failover when the main box is unreachable
- **Backup Box Host** — IP of the backup machine (same AMCP + HTTP ports)

While main is up, all actions go to main only. If main disconnects, Companion automatically switches to the backup host and switches back when main returns.

Variables: `highascg_connection_target` (`main` / `backup`), `highascg_active_host`

## Variables

When the bridge is enabled, HighAsCG internal variables are exposed as Companion variables with the prefix `highascg_` (for example `highascg_app_uptime`).

## Actions

- **Direct TCP:** Play Clip, Stop Layer, Clear, Raw AMCP
- **Bridge:** Scene Take, Timeline Play/Stop, Audio Volume (via HighAsCG API), Apply Multiview Layout
- **Wake on LAN:** Wake stored target or arbitrary MAC via magic packet (target must be powered off via soft shutdown, not cold boot)

Ensure the HighAsCG app is running and reachable before expecting bridge actions or variables to work.

### Wake on LAN

Store the target box **MAC address**, **hostname** (optional, for display), and **IP** (optional, for display) in Companion's instance configuration. Two actions are available:

- **Wake stored target** — sends magic packet to the configured MAC address via the broadcast address and port you set
- **Wake by MAC** — one-off action with per-action MAC, broadcast, and port options

## Dev Mode

For rapid iteration during development, use the dev-mode workflow instead of rebuilding and reinstalling the packaged module each time.

### Setup

Run the dev-mode setup script once:

```bash
/home/casparcg/highascg/tools/eggs/companion/dev-mode.sh
```

This creates a symlink so Companion loads the module from the dev checkout in `/home/casparcg/companion-module-dev/companion-module-highpass-highascg/`.

**Note:** Companion v5.0 is configured to load from the dev path via the systemd override at `/etc/systemd/system/companion.service.d/override.conf` (which specifies `--extra-module-path /home/casparcg/companion-module-dev`).

### Development Loop

1. **Edit source files:**
   ```bash
   cd /home/casparcg/companion-module-dev/companion-module-highpass-highascg
   # Edit files in ./src/
   ```

2. **Rebuild the module:**
   ```bash
   npm run package:dev
   # or: npm run package
   ```

3. **Reload Companion to load the updated module:**
   ```bash
   sudo systemctl restart companion
   ```

4. **Verify it loaded:**
   ```bash
   journalctl -u companion --since '1 min ago' | grep -i highpass
   ```

### Switching Back to Packaged Module

If you want to return to the standard packaged installation:

```bash
cd /home/casparcg/highascg
sudo systemctl stop companion
./tools/eggs/companion/install-companion-module.sh
sudo systemctl start companion
```

Or manually remove the dev symlink and reinstall:

```bash
rm /home/casparcg/companion-module-dev/highpass-highascg
# Then run the install script above
```

## Building

The module uses `companion-module-build` to bundle the source:

```bash
# Production build (minified)
npm run package

# Development build (source maps, faster)
npm run package:dev
```

Builds output to `./pkg/highpass-highascg/` and can be tested locally or packaged as a `.tgz` for distribution.

## Testing

```bash
npm test
```

## License

MIT
