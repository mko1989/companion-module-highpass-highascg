# WO-170 — Companion Module API Parity: Manual QA Checklist

**Date:** 2026-07-13  
**Module Version:** 1.0.2  
**Test Scope:** RTMP/record actions, multiview layout, timeline take/sendto, countdown control, status feedbacks, and variables

---

## A170.1 — RTMP Streaming & Recording

### RTMP Start/Stop Actions

- [ ] **Action: RTMP Start**
  - [ ] Configure RTMP server URL and stream key in a button
  - [ ] Press button → server should start RTMP stream
  - [ ] Companion log shows no errors
  - [ ] Variable `highascg_rtmp_state` changes to `"active"`
  - [ ] Feedback `streaming_active` highlights the button
  - [ ] Variable `highascg_rtmp_url` shows the configured URL

- [ ] **Action: RTMP Stop**
  - [ ] While RTMP is active, press stop button
  - [ ] Server should stop RTMP stream
  - [ ] Companion log shows no errors
  - [ ] Variable `highascg_rtmp_state` changes to `"inactive"`
  - [ ] Feedback `streaming_active` no longer highlights the button

- [ ] **Quality & Codec Options**
  - [ ] Configure a button with quality preset (low/medium/high)
  - [ ] Optional fields: video codec, bitrate, audio codec
  - [ ] Press button → stream starts with configured parameters
  - [ ] Server logs confirm the correct ffmpeg parameters were used

- [ ] **Output ID Option**
  - [ ] If configured, output ID is passed to the server
  - [ ] Server uses the corresponding preset from settings

### Record Start/Stop Actions

- [ ] **Action: Record Start**
  - [ ] Configure record start button with defaults
  - [ ] Press button → server should start recording
  - [ ] Companion log shows no errors
  - [ ] Variable `highascg_record_state` changes to `"recording"`
  - [ ] Feedback `recording_active` highlights the button
  - [ ] Variable `highascg_record_path` shows the file path

- [ ] **Action: Record Stop**
  - [ ] While recording, press stop button
  - [ ] Server should stop recording and close file
  - [ ] Companion log shows no errors
  - [ ] Variable `highascg_record_state` changes to `"idle"`
  - [ ] Feedback `recording_active` no longer highlights the button
  - [ ] Recorded file exists at the path shown in variable

- [ ] **CRF Quality (Quantization)**
  - [ ] Configure button with CRF value (test: 20, 26 default, 40)
  - [ ] Press button → recording starts
  - [ ] Check file properties (ffprobe) to confirm CRF value used

- [ ] **Output ID for Multiple Recordings**
  - [ ] Configure two record buttons with different `outputId` values
  - [ ] Start recording on output ID 1 → check variable `highascg_record_output_id`
  - [ ] Start recording on output ID 2 → should handle multiple sessions
  - [ ] Stop by output ID 1 → stops correct session
  - [ ] Stop by output ID 2 → stops correct session

### Status Feedback & Variables

- [ ] **Variables Update via Polling**
  - [ ] Disconnect WebSocket (e.g., kill HighAsCG WS connection)
  - [ ] Trigger RTMP start → poll should detect status within ~2 seconds
  - [ ] Variables `highascg_rtmp_state` and `highascg_record_state` reflect live status
  - [ ] Feedbacks update to match polled state

- [ ] **Variables Update via WebSocket (if WS reconnects)**
  - [ ] Reconnect WebSocket
  - [ ] Trigger RTMP/record action
  - [ ] Variables update immediately (no ~2s polling delay)

---

## A170.2 — Multiview Layout Switching

- [ ] **Action: Multiview Apply**
  - [ ] Create button with sample layout JSON (ask owner for valid test config)
  - [ ] Press button → multiview layout should apply to the configured multiviewer
  - [ ] Companion log shows no errors
  - [ ] Video output reflects new layout (cells, routing visible on hardware)

- [ ] **Multiviewer Index (n parameter)**
  - [ ] If server supports multiple multiviewers, test `n=1` and `n=2`
  - [ ] Correct multiviewer is selected and layout applies

---

## A170.3 — Dead Method Removal

- [ ] **Confirm toggleStreaming() is not called**
  - [ ] Search module repo: no action or code calls `toggleStreaming()`
  - [ ] Method removed from `api-client.js` (T170.3 decision documented in CHANGELOG)

- [ ] **Confirm restartServer() is not called**
  - [ ] Search module repo: no action or code calls `restartServer()`
  - [ ] Method removed from `api-client.js` (T170.3 decision documented in CHANGELOG)

---

## A170.4 — Timeline Take / SendTo Actions

- [ ] **Action: Timeline Take**
  - [ ] Configure button with timeline ID
  - [ ] Set sendTo options (preview/program, screen index)
  - [ ] Press button → timeline should cut to output bus with sendTo routing
  - [ ] Companion log shows no errors

- [ ] **Action: Timeline SendTo**
  - [ ] Configure button to set routing without playing
  - [ ] Press button → timeline routing updated (does not play)
  - [ ] Verify on hardware or in HighAsCG UI

---

## A170.5 — Countdown Template Actions

- [ ] **Action: Countdown Start**
  - [ ] Configure button with channel and layer number (e.g., CH 1, Layer 10)
  - [ ] Press button → countdown template should start (CG UPDATE with cmd: 'start')
  - [ ] Companion log shows no errors
  - [ ] Countdown runs on the configured layer on-air (hardware check)

- [ ] **Action: Countdown Pause**
  - [ ] While countdown running, press pause button
  - [ ] Countdown should pause
  - [ ] Resume after press → runs from paused position

- [ ] **Action: Countdown Reset**
  - [ ] While countdown running, press reset button
  - [ ] Countdown should reset to configured duration
  - [ ] Visual on hardware confirms reset

- [ ] **Action: Countdown Set**
  - [ ] Configure button with optional duration (ms), title, subtitle
  - [ ] Press button → countdown config updated (CG UPDATE without cmd)
  - [ ] On hardware, countdown shows new title/subtitle and duration

- [ ] **GET /api/countdown/list**
  - [ ] Verify endpoint callable from bridge
  - [ ] Returns list of active countdown layers with channel/layer/label info

---

## A170.6 — Module Build & Hygiene

- [ ] **Module version bumped to 1.0.2**
  - [ ] `package.json`: version is `"1.0.2"`
  - [ ] `companion/manifest.json`: version is `"1.0.2"`

- [ ] **Syntax validation**
  - [ ] All `.js` files pass `node --check`
  - [ ] No TypeScript/JSDoc errors in IDE

- [ ] **Changelog present**
  - [ ] `CHANGELOG.md` exists and documents all changes for v1.0.2

- [ ] **Actions registered**
  - [ ] `src/actions/streaming-actions.js` exported in `highascg-actions.js`
  - [ ] `src/actions/multiview-actions.js` exported in `highascg-actions.js`
  - [ ] `src/actions/countdown-actions.js` exported in `highascg-actions.js`
  - [ ] `timeline_take` and `timeline_sendto` added to `timeline-actions.js`

- [ ] **Variables & Feedbacks registered**
  - [ ] `highascg_rtmp_state`, `highascg_rtmp_url`, `highascg_record_state`, etc. in variables definition
  - [ ] `streaming_active` and `recording_active` feedbacks in feedbacks definition

- [ ] **Bridge poller initialized**
  - [ ] `StreamingChannelPoller` created in `bridge/index.js`
  - [ ] Poller starts on bridge init
  - [ ] Poller stops on bridge destroy

---

## A170.1 (Acceptance Criteria) — Hardware Check

> **"From Companion: RTMP start/stop and record start/stop on the configured outputs work with visible status feedback (hardware check with owner)."**

- [ ] **Live on hardware (final sign-off)**
  - [ ] RTMP start → stream appears on destination (YouTube, Twitch, etc.)
  - [ ] Record start → file recorded and playable
  - [ ] Status variables/feedbacks match actual state
  - [ ] Owner verifies action behavior matches expectations
  - [ ] No unexpected side effects or error logs

---

## A170.2 (Acceptance Criteria) — Multiview

> **"Multiview layout switch action works."**

- [ ] **Layout switching verified**
  - [ ] Action applies valid layout JSON
  - [ ] Multiviewer on hardware reflects changes
  - [ ] No errors or timeouts

---

## A170.3 (Acceptance Criteria) — Dead Methods Removal

> **"No dead api-client methods remain (each wired to an action or removed)."**

- [ ] **All methods are used or removed**
  - [ ] No unused public methods in `api-client.js`
  - [ ] `toggleStreaming` and `restartServer` removed
  - [ ] Decision documented in CHANGELOG

---

## A170.4 (Acceptance Criteria) — Module Build

> **"Module lints/builds green in its own repo; version bumped."**

- [ ] **Syntax validation passes**
  - [ ] `node --check` on all `.js` files
  - [ ] No import/export errors

- [ ] **Version updated**
  - [ ] `package.json` → `1.0.2`
  - [ ] `companion/manifest.json` → `1.0.2`

- [ ] **Can build package**
  - [ ] `npm run package` or `yarn package` succeeds (optional—pre-deploy test)
  - [ ] No blocking errors

---

## Notes

- **WO-171 coordination:** If WO-171 changes streaming-channel API shape, re-test all streaming actions.
- **WebSocket vs. Polling:** Test both scenarios (WS up and WS down) to confirm status updates work in both paths.
- **Error handling:** Intentionally trigger errors (e.g., bad RTMP URL, disconnected server) and verify Companion logs them clearly.
- **Multiviewer config:** Coordinate with owner to obtain valid layout JSON for testing (may be project-specific).

---

**QA Lead Sign-Off:** _________________ **Date:** _____________
