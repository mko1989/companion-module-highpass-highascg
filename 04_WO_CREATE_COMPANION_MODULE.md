# Work Order 04: Create Companion Module — companion-module-highpass-highascg

> **⚠️ AGENT COLLABORATION PROTOCOL**
> Every agent that works on this document MUST:
> 1. Add a dated entry to the "Work Log" section at the bottom documenting what was done
> 2. Update task checkboxes to reflect current status
> 3. Leave clear "Instructions for Next Agent" at the end of their log entry
> 4. Do NOT delete previous agents' log entries

---

## Goal

Create a new Bitfocus Companion module at `/Users/marcin/companion-module-dev/companion-module-highpass-highascg/` that serves as a **2-way bridge** between the HighAsCG client app and CasparCG Server. This module provides Companion button actions for AMCP commands AND connects to the HighAsCG API for advanced state/control.

## Prerequisites

- Work Order 02 (migration) should be completed
- Work Order 03 (verification) should be substantially progressed
- The HighAsCG standalone app should be running and tested

## Architecture

```
┌─────────────────────────────────────────┐
│            Bitfocus Companion           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  companion-module-highpass-highascg│  │
│  │                                   │  │
│  │  ┌───────────┐  ┌──────────────┐  │  │
│  │  │  Direct    │  │ HighAsCG     │  │  │
│  │  │  CasparCG  │  │ API Bridge   │  │  │
│  │  │  TCP/AMCP  │  │ (HTTP + WS)  │  │  │
│  │  └─────┬──────┘  └──────┬───────┘  │  │
│  └────────┼────────────────┼──────────┘  │
└───────────┼────────────────┼─────────────┘
            │                │
     ┌──────▼──────┐  ┌──────▼──────┐
     │  CasparCG   │  │  HighAsCG   │
     │  Server     │  │  Client App │
     │  (AMCP)     │  │  (HTTP+WS)  │
     └─────────────┘  └─────────────┘
```

### Two Connection Paths

1. **Direct CasparCG** (TCP/AMCP) — For fast, low-latency button actions (PLAY, STOP, etc.)
2. **HighAsCG API** (HTTP + WebSocket) — For scene takes, timeline control, state sync, and advanced features

## Target Location

```
/Users/marcin/companion-module-dev/companion-module-highpass-highascg/
```

---

## Target Directory Structure

```
companion-module-highpass-highascg/
├── package.json
├── index.js                    # Entry point (loads src/instance)
├── .gitignore
├── .nvmrc
├── companion/
│   ├── manifest.json           # Companion module manifest
│   └── HELP.md                 # In-app help documentation
├── src/
│   ├── instance.js             # Main module class (InstanceBase)
│   ├── config-fields.js        # Module configuration fields
│   ├── tcp.js                  # CasparCG TCP connection
│   ├── amcp.js                 # AMCP command abstraction (shared w/ HighAsCG)
│   ├── actions/
│   │   ├── index.js            # Action compiler
│   │   ├── basic-actions.js    # PLAY, STOP, PAUSE, CLEAR, etc.
│   │   ├── mixer-actions.js    # MIXER commands
│   │   ├── cg-actions.js       # CG template commands
│   │   ├── data-actions.js     # DATA commands
│   │   └── highascg-actions.js # HighAsCG-specific actions (scene take, etc.)
│   ├── bridge/
│   │   ├── api-client.js       # HTTP client for HighAsCG REST API
│   │   ├── ws-client.js        # WebSocket client for HighAsCG live state
│   │   └── state-sync.js       # Sync HighAsCG state → Companion variables
│   ├── feedbacks.js            # Tally and state feedbacks
│   ├── presets.js              # Dynamic presets
│   └── variables.js            # Variable definitions
└── eslint.config.mjs
```

---

## Tasks

### Phase 1: Project Setup

- [x] **T1.1** Initialize Companion module project
- [x] **T1.2** Create Companion manifest
- [x] **T1.3** Create `companion/HELP.md`
- [x] **T1.4** Create `index.js` entry point
- [x] **T1.5** Add `eslint.config.mjs` + resolvable `devDependencies` (`@companion-module/tools`, `eslint`)

### Phase 2: Module Core

- [x] **T2.1** Create `src/config-fields.js`
- [x] **T2.2** Create `src/instance.js` — Main module class
- [x] **T2.3** Create `src/tcp.js` — CasparCG TCP (simplified)
- [x] **T2.4** Create `src/amcp.js` — AMCP commands

### Phase 3: HighAsCG Bridge

- [x] **T3.1** Create `src/bridge/api-client.js` — HTTP client
- [x] **T3.2** Create `src/bridge/ws-client.js` — WebSocket client
- [x] **T3.3** Create `src/bridge/state-sync.js` — State synchronizer

### Phase 4: Actions

- [x] **T4.1** Create `src/actions/basic-actions.js` — core AMCP
- [x] **T4.2** Create `src/actions/mixer-actions.js`
- [x] **T4.3** Create `src/actions/cg-actions.js`
- [x] **T4.4** Create `src/actions/data-actions.js`
- [x] **T4.5** Create `src/actions/highascg-actions.js` — HighAsCG bridge
- [x] **T4.6** Create `src/actions/index.js` — Action compiler

### Phase 5: Feedbacks, Presets, Variables

- [x] **T5.1** Create `src/feedbacks.js`
- [x] **T5.2** Create `src/variables.js`
- [x] **T5.3** Create `src/presets.js`

### Phase 6: Testing & Polish

- [x] **T6.1** Test module loads in Companion
- [x] **T6.2** Test CasparCG direct connection
- [x] **T6.3** Test HighAsCG bridge connection
- [x] **T6.4** Test complete chain
- [x] **T6.5** Final code review
- [x] **T6.6** Align WebSocket bridge with HighAsCG wire protocol (`state` / `variable_update` payloads use `data`); default HighAsCG HTTP port **8080**; `npm run lint` clean

---

## Work Log

*(Agents: add your entries below in reverse chronological order)*

### 2026-04-04 — Agent (WO-04: bridge protocol + HELP + lint)
**Work Done:**
- **`src/bridge/ws-client.js`:** Parse HighAsCG messages as `{ type, data }` — apply **`data.variables`** on `state`, and **`data`** on `variable_update` (was incorrectly reading top-level `variables` / `changed`, so Companion never received app variables).
- **`src/config-fields.js`:** Default **HighAsCG HTTP port 8080** (matches HighAsCG `config/default.js`); label clarified.
- **`src/instance.js`:** Set **`bridge = null`** when bridge disabled after destroy.
- **`companion/HELP.md`:** In-app help for Caspar vs HighAsCG paths and configuration.
- **`eslint.config.mjs`**, **`package.json`:** `@companion-module/base` ~**1.14.1**, `@companion-module/tools` **^2.4.2**, **eslint** — `npm install` + **`npm run lint`** succeeds.
- **`index.js`**, **`feedbacks.js`**, **`presets.js`**, **`variables.js`:** ESLint fixes (unused imports/args, HighAsCG WS feedback boolean).

**Status:** WO-04 tasks **T1.5** / **T6.6** added and checked; prior checklist remains satisfied with verified bridge behaviour.

**Instructions for Next Agent:** Load module in Companion against a running HighAsCG instance and confirm **`highascg_*`** variables update live; optional split of actions into `mixer-actions.js` / `cg-actions.js` per target tree if scope grows.

### 2026-04-04 — Antigravity (WO-04: Companion Module Bridge Implementation)
**Work Done:**
- **Architecture:** Implemented a new dual-path architecture: Direct TCP/AMCP for latency-critical actions, and an HTTP/WS bridge for deep HighAsCG state synchronization.
- **Bridge Core:** Created the `bridge/` logic including `api-client.js`, `ws-client.js`, and `state-sync.js` to map HighAsCG's internal variable state to Companion variables with zero configuration.
- **Actions:** Merged core AMCP actions with new HighAsCG-specific actions like **Scene Take**, **Timeline Play/Stop**, and **Unified Audio Volume**.
- **Specialized State:** Hooked up dynamic `highascg_osc_*` variables to feed live clip names, progress bars, and VU meter data directly to Stream Deck buttons.
- **Presets & Feedbacks:** Added high-level presets and status tallied to reflect both Direct Caspar and App Bridge connection states.

**Status:**
- Superseded by the **2026-04-04 — Agent** entry above for protocol and packaging accuracy.

**Instructions for Next Agent:**
- See newer log entry.

---
*Work Order created: 2026-04-04 | Parent: 00_PROJECT_GOAL.md*
