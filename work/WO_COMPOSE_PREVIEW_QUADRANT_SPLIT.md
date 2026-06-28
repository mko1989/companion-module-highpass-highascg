# WO: Compose preview quadrant split (Stream Deck)

**Status:** In progress (v1: ffmpeg splitter + derived variables + presets)  
**Module:** `companion-module-highpass-highascg`  
**Related server:** HighAsCG `compose_preview_ch{N}_image` variables (data-URI JPEG)

## Goal

Show one compose-preview channel across **four adjacent Stream Deck buttons**, each displaying a **quadrant** (2×2 grid) of the same live image — preview only, **no actions**, **no feedbacks**.

Full-frame preview presets already exist under **HighAsCG · Compose preview**. Quadrant presets live under **HighAsCG · Compose preview · Quadrants**.

## Architecture

```
HighAsCG (15 fps)
  compose_preview_ch1_image  (data:image/jpeg;base64,…)
        │
        ▼ WebSocket variable_update
Companion module (state-sync)
  preview-split/quadrant-splitter.js  (ffmpeg crop ×4, debounced per channel)
        │
        ▼ setVariableValues (module-local derived keys)
  highascg_compose_preview_ch1_quad_tl … br
        │
        ▼ button style png64 = $(variable:…)
Stream Deck (4 buttons, 2×2 layout)
```

## Deliverables

| ID | Task | Status |
|----|------|--------|
| T1 | Presets: full-frame `preview_ch{N}` (no actions) | Done |
| T2 | Presets: quadrant `preview_ch{N}_quad_{tl,tr,bl,br}` | Done |
| T3 | `src/preview-split/quadrant-splitter.js` (ffmpeg crop) | Done (v1) |
| T4 | Wire splitter in `bridge/state-sync.js` on preview variable updates | Done (v1) |
| T5 | Variable defs for `highascg_compose_preview_ch*_quad_*` | Done |
| T6 | Skip `checkFeedbacks()` for preview + quad variable churn | Done |

## Follow-up (backlog)

| ID | Task | Notes |
|----|------|-------|
| T7 | **In-memory crop** without temp files | Use `sharp` or `@napi-rs/canvas` if added as dependency; reduces disk IO at 15 fps × N channels |
| T8 | **Configurable quadrant layout** | 2×2 default; optional 3×3 or custom crop rects in module config |
| T9 | **Server-side split option** | HighAsCG could emit quad variables directly to avoid duplicate ffmpeg in Companion process |
| T10 | **Composite element presets** | Companion 5 composite/canvas styling if png64 variable binding is insufficient on some surfaces |
| T11 | **Unit tests** | Mock ffmpeg; test parseDataUri, hash debounce, variable key naming |
| T12 | **Performance guard** | Max channels to split concurrently; drop frames if split slower than compose fps |

## Operator setup

1. HighAsCG → Settings → enable **Companion preview variables**.
2. Companion → add **HighAsCG** connection (bridge enabled).
3. Drag presets from **HighAsCG · Compose preview** (full) or **Quadrants** (2×2).
4. Place four quadrant buttons adjacent on the Stream Deck page.

## Variable reference

| HighAsCG key | Companion variable | Use |
|--------------|-------------------|-----|
| `compose_preview_ch1_image` | `highascg_compose_preview_ch1_image` | Full frame |
| *(derived in module)* | `highascg_compose_preview_ch1_quad_tl` | Top-left quadrant |
| | `highascg_compose_preview_ch1_quad_tr` | Top-right |
| | `highascg_compose_preview_ch1_quad_bl` | Bottom-left |
| | `highascg_compose_preview_ch1_quad_br` | Bottom-right |

Button image expression: `$(variable:highascg_compose_preview_ch1_quad_tl)` (presets set this in `style.png64`).

## Acceptance

- [ ] With compose preview at 15 fps, four quadrant buttons update in sync with full preview (within one split latency ~50–200 ms).
- [ ] Buttons have **no actions**; pressing does nothing.
- [ ] Disabling Companion preview variables clears quad variables on reconnect.
- [ ] ffmpeg missing → quad vars stay empty; module logs debug message, no crash.
