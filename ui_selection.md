# Companion module: UI selection variables (`ui_selection_*`)

HighAsCG pushes **inspector selection** from the web UI into the same **Companion-style variable map** used for OSC, channel INFO, and app stats. This module exposes them as **`highascg_<server_key>`** (for example `highascg_ui_selection_context`), synced via WebSocket **`variable_update`**, optional **`selection_sync`**, or **`GET /api/state`** / **`GET /api/variables?prefix=ui_selection_`**.

## Behaviour (HighAsCG)

1. The UI posts **`POST /api/selection`** (debounced, JSON body).
2. The server maps into **`state.variables`** with keys prefixed **`ui_selection_`**.
3. Companion mirrors incoming keys; **`src/variables.js`** registers definitions for all keys below so labels appear immediately.

## `ui_selection_context` values

| Server value       | Meaning                    | Detail prefix      |
|--------------------|----------------------------|--------------------|
| `none`             | No actionable selection   | —                  |
| `scene_layer`      | Looks editor layer selected | `ui_selection_look_*` |
| `timeline_clip`    | Timeline clip selected      | `ui_selection_tl_*`   |
| `multiview`        | Multiview cell selected    | `ui_selection_mv_*`    |

Always read **`ui_selection_context`** first; stale keys from another prefix should be ignored until new values arrive.

## Complete key list (55)

Companion variable IDs use prefix **`highascg_`** (e.g. `highascg_ui_selection_look_fill_x`).

### Shared (2)

- `ui_selection_context`
- `ui_selection_label`

### Look editor — `scene_layer` — `ui_selection_look_*` (31)

- `ui_selection_look_id`
- `ui_selection_look_name`
- `ui_selection_look_layer_index`
- `ui_selection_look_layer_number`
- `ui_selection_look_preview_channel`
- `ui_selection_look_caspar_layer`
- `ui_selection_look_screen_index`
- `ui_selection_look_canvas_w`
- `ui_selection_look_canvas_h`
- `ui_selection_look_fill_x`
- `ui_selection_look_fill_y`
- `ui_selection_look_fill_scale_x`
- `ui_selection_look_fill_scale_y`
- `ui_selection_look_rotation`
- `ui_selection_look_opacity`
- `ui_selection_look_source_type`
- `ui_selection_look_source_value`
- `ui_selection_look_source_label`
- `ui_selection_look_loop`
- `ui_selection_look_audio_route`
- `ui_selection_look_volume`
- `ui_selection_look_muted`
- `ui_selection_look_straight_alpha`
- `ui_selection_look_content_fit`
- `ui_selection_look_aspect_locked`
- `ui_selection_look_transition_json`
- `ui_selection_look_fade_on_end_json`
- `ui_selection_look_effects_json`
- `ui_selection_look_pip_overlays_json`
- `ui_selection_look_start_behaviour`
- `ui_selection_look_layer_json`

### Timeline clip — `timeline_clip` — `ui_selection_tl_*` (12)

- `ui_selection_tl_timeline_id`
- `ui_selection_tl_layer_idx`
- `ui_selection_tl_clip_id`
- `ui_selection_tl_aspect_locked`
- `ui_selection_tl_pixel_x`
- `ui_selection_tl_pixel_y`
- `ui_selection_tl_pixel_w`
- `ui_selection_tl_pixel_h`
- `ui_selection_tl_fill_x`
- `ui_selection_tl_fill_y`
- `ui_selection_tl_scale_x`
- `ui_selection_tl_scale_y`

### Multiview — `multiview` — `ui_selection_mv_*` (10)

- `ui_selection_mv_cell_id`
- `ui_selection_mv_layer_index`
- `ui_selection_mv_channel`
- `ui_selection_mv_canvas_w`
- `ui_selection_mv_canvas_h`
- `ui_selection_mv_x`
- `ui_selection_mv_y`
- `ui_selection_mv_w`
- `ui_selection_mv_h`
- `ui_selection_mv_aspect_locked`

## Mixer actions note

**Selected layer** paint actions (`POST /api/mixer/*`) use **`scene_layer`** routing only: **`ui_selection_look_preview_channel`** + **`ui_selection_look_caspar_layer`** (fallback **`ui_selection_look_layer_number`**). Timeline and multiview selections expose variables for workflows but do not drive those mixer shortcuts automatically.
