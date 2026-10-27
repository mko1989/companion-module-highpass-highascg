# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.9] - 2026-09-30

### Added — playlist control
- Actions: **Playlist: Next / Previous item**, **Go to item**, **Play current item from the start**,
  **Select playlist**, **Select next / previous playlist**. Same rules as the web Playlists panel:
  a live playlist moves on program; a not-live one moves its start item (and the PRV render).
- Variables (polled from `GET /api/playlist/state` every 1 s): per playlist
  `highascg_playlist_<look8>_l<layer>_{name,item,item_number,next_item,prev_item,count,position,state,channel}`
  plus `…_item_<n>` per item, and the same set for Companion's selected playlist as
  `highascg_playlist_sel_*` — use `$(highascg:highascg_playlist_sel_item)` as a button name.
- Feedbacks: `playlist_item_active`, `playlist_is_live`, `playlist_is_selected`.
- Presets: "HighAsCG · Playlists" (selected-playlist Prev / Item / Next, playlist selectors) and
  one section per playlist (Prev / Item / Next + a Go-to button per item).

### Added — global border (needs HighAsCG with WO-585, `POST /api/scene/global-border`)
- Actions: **Global border: On / Off / Toggle**, **Set colour** (main / glow / second / alternate),
  **Set opacity** (%, `+N`/`-N` nudges), **Set parameter** (width, speed, pulse… — numbers, nudges or
  true/false), **Set type**, **Set fade duration**, **Recall preset** (border inspector presets).
  HighAsCG switches the border on air and saves it; the web UI follows.
- Feedback `global_border_on`; variables `highascg_global_border_<n>_{state,type,color,opacity}`.
- Presets "HighAsCG · Global border": one toggle per screen (red while on).
- HighAsCG side of the same WO: a Companion look take no longer fades out a border that is on.

### Added — fade to black
- Actions **Fade to black: Screen** (screen dropdown named from HighAsCG) and
  **Fade to black: All screens** — `POST /api/ftb`, same as the web FTB button: PGM + PRV fade
  out, then clear. Fade length (1–120 frames, default 25) and tween are options.
- Presets "HighAsCG · Fade to black": **FTB ALL** plus one **FTB <screen name>** per screen.
- Screen dropdowns and per-screen presets now rebuild when the screen count or names change.

## [1.0.8] - 2026-07-30

### Changed (WO-394 — HighAsCG-only module)
- The module is a **HighAsCG module**: the direct CasparCG TCP/AMCP client is gone.
  `play`/`stop`/`clear` actions removed; the **Raw AMCP Command** action remains and is sent
  through the app (`POST /api/amcp/raw` — normalized, playback-tracked, failover-aware).
- Config: **AMCP Port** and **Use HighAsCG Bridge** fields removed (the bridge IS the module);
  "+ CasparCG" framing dropped from manifest/README.
- `caspar_connected` feedback keeps its id but now reflects the app's own Caspar link
  (`state.caspar.connected`) instead of the removed direct socket.

### Added (WO-395 — configured-output stream/record control)
- `rtmp_start`/`record_start`/`record_stop` options are now **dropdowns of the outputs
  actually configured on the box** (from `GET /api/streaming-channel` `outputs`) — no
  free-text URL/key/codec placeholders; credentials resolve server-side on start.
- `streaming_active`/`recording_active` feedbacks accept an optional **Output** filter
  ("Any" default keeps old buttons working).
- New preset section **HighAsCG · Stream & Record**: Start (with live tally) + Stop buttons
  per configured stream/record output, regenerated when the output catalog changes.

### Fixed
- Streaming/record status was **frozen while the WebSocket was up**: the poller only runs as
  a WS-down fallback but the `streaming_channel` broadcast was never handled. Feedbacks and
  variables now update live from the broadcast.
- `highascg_record_state` never left `idle` (the server's `sessions` list has no `active`
  flag) — now derived from `record.active`/`activeOutputs`.

## [1.0.4] - 2026-07-25

### Removed
- **Wake-on-LAN (owner decision, desk QA 2026-07-25):** all WoL config fields, actions, the
  `wol_target` variable, and the packet test. The regex-validated WoL fields also blocked
  saving the connection config while empty (Companion validates `regex` even on optional
  empty textinputs), which was the reported "cannot save config" bug.

### Fixed
- Quad compose-preview presets `preview_chN_quad_br` were rejected by Companion 5's
  layered-element schema (x/y/width/height are 0..100): the screen badge used `x: -20`.
  Re-expressed as `x: 0, width: 80, halign: right` — same visible position.
- `look_take` buttons saved before the `target` (Bus) option existed failed to parse
  ("Value is not in the list of choices") because Companion 5 hard-fails a strict dropdown
  on a missing stored value. The dropdown now allows custom values and the callback keeps
  defaulting anything non-`preview` to program.

## [1.0.3] - 2026-07-14

### Added
- **Wake-on-LAN Actions (WO-216):**
  - `wol_wake_stored`: Wake configured target box via stored MAC address, broadcast, and port
  - `wol_wake_mac`: Ad-hoc wake-on-LAN by per-action MAC, broadcast, and port options
  - Instance config fields: `wol_mac` (MAC address with regex validation), `wol_hostname`, `wol_ip`, `wol_broadcast` (default 255.255.255.255), `wol_port` (default 9)
  - Variable: `wol_target` displays hostname and IP for button labels (fallback to MAC if not set)
  - Pure helper `buildWolPacket(mac)` exported for testing; uses standard 102-byte magic packet format (6×0xFF + 16 MAC repeats)
  - `sendWol()` uses dgram UDP4 broadcast with 3 packets @ 100ms spacing (standard WoL reliability practice)

### Fixed
- All syntax validated with `node --check`

## [1.0.2] - 2026-07-13

### Added
- **Streaming & Recording Actions (WO-170):**
  - `rtmp_start`: Start RTMP streaming with configurable server URL, stream key, quality, and codec options
  - `rtmp_stop`: Stop RTMP streaming
  - `record_start`: Start recording with optional output ID and CRF quality control
  - `record_stop`: Stop recording with optional output ID
  - `streaming_active` feedback: Visual indicator when RTMP streaming is active
  - `recording_active` feedback: Visual indicator when recording is active
  - Variables: `highascg_rtmp_state`, `highascg_rtmp_url`, `highascg_record_state`, `highascg_record_path`, `highascg_record_output_id`
  - Streaming channel poller: Polls GET `/api/streaming-channel` when WebSocket is disconnected to keep status updated

- **Multiview Action (WO-170):**
  - `multiview_apply`: Apply multiview layout with JSON configuration for layout cells and routing

- **Timeline Actions (WO-170):**
  - `timeline_take`: Direct timeline take to output bus with sendTo routing
  - `timeline_sendto`: Set timeline sendTo routing (preview/program/screen index)

- **Countdown Actions (WO-170):**
  - `countdown_start`: Start countdown template
  - `countdown_pause`: Pause countdown template
  - `countdown_reset`: Reset countdown template
  - `countdown_set`: Set countdown configuration (duration, title, subtitle)
  - API endpoint: GET `/api/countdown/list` to enumerate countdown layers

### Changed
- **API Client (WO-170):**
  - Added `getStreamingChannelStatus()`: Fetch current streaming/recording status
  - Added `rtmpStreaming()`: Control RTMP start/stop with full options
  - Added `recordStreaming()`: Control recording start/stop with quality options
  - Added `timelineTake()`: Direct timeline take with sendTo routing
  - Added `timelineSendTo()`: Set timeline routing separately
  - Added `countdownControl()`: Generic countdown template control
  - Added `getCountdownList()`: Enumerate countdown layers

- Bridge initialization now includes `streamingChannelPoller` for status updates

### Removed
- **Dead API methods (WO-170 T170.3):**
  - `toggleStreaming()`: Legacy `/api/streaming/toggle` (superseded by streaming-channel RTMP API)
  - `restartServer()`: `/api/restart` (not wired to any action)
  - **Decision:** These legacy methods had no callers in the module and are replaced by the streaming-channel API which provides per-output control. The server still supports these routes for backward compatibility if needed by external systems.

### Fixed
- All syntax validated with `node --check`

## [1.0.1] - Previous release
- Compose preview support for channels with WebSocket and HTTP fallback
- Full project sync and look management
- Timeline playback control (play/pause/stop/seek/loop)
- Mixer layer and PIP overlay actions
- Audio volume, scene take, and selection actions
