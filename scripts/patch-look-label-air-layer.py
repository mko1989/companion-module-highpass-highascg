#!/usr/bin/env python3
"""
Fix layered look recall buttons:
- Button local variables (look_id, screen_index) shared by action + feedbacks
- Preview layers bind to channel compose vars (not per-look hardcoded ids)
- PGM/PRV feedbacks only toggle border + matching preview layer opacity
"""
from __future__ import annotations

import json
import re
import secrets
import shutil
import sqlite3
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

DB = Path("/home/casparcg/.config/companion/v5.0/db.sqlite")
MODULE_ID = "highpass-highascg"
CONNECTION_LABEL = "HighAsCG"
LABEL_AIR_ID = "label_air"
LABEL_IDLE_ID = "label"
IDLE_BG_ID = "idle_bg"
LABEL_BOTTOM_Y = 52
LABEL_BOTTOM_H = 48
LABEL_ON_AIR_FONTSIZE = 36
TRANSPARENT_FILL = 4278190080
BORDER_WIDTH = 4
LOOK_FEEDBACKS = {"look_on_pgm", "look_on_prv_for_screen"}
LOCAL_LOOK_ID = "$(local:look_id)"
LOCAL_SCREEN_INDEX = "$(local:screen_index)"


def literal(value):
    return {"isExpression": False, "value": value}


def expr(value: str):
    return {"isExpression": True, "value": value}


def resolve_connection_label(conn: sqlite3.Connection) -> str:
    cur = conn.cursor()
    cur.execute("SELECT value FROM instances")
    for (raw,) in cur.fetchall():
        inst = json.loads(raw)
        if inst.get("moduleId") == MODULE_ID:
            label = str(inst.get("label") or "").strip()
            if label:
                return label
    return CONNECTION_LABEL


def var_expr(var_id: str):
    return {"isExpression": True, "value": f"$({CONNECTION_LABEL}:{var_id})"}


def fetch_channel_map() -> dict:
    try:
        with urllib.request.urlopen("http://127.0.0.1:4200/api/state", timeout=2) as resp:
            data = json.loads(resp.read().decode())
            return data.get("channelMap") or {}
    except OSError:
        return {"programChannels": [1, 3], "previewChannels": [2, None]}


def channels_for_screen(cm: dict, screen_index: int) -> tuple[int, int | None]:
    pgm = cm.get("programChannels") or []
    prv = cm.get("previewChannels") or []
    idx = max(0, int(screen_index or 0))
    pgm_ch = int(pgm[idx]) if idx < len(pgm) and pgm[idx] else idx + 1
    prv_raw = prv[idx] if idx < len(prv) else None
    prv_num = int(prv_raw) if prv_raw not in (None, "", 0) else None
    if prv_num is not None and prv_num == pgm_ch:
        prv_num = None
    return pgm_ch, prv_num


def new_override_id() -> str:
    return secrets.token_urlsafe(16)[:21]


def override_entry(element_id: str, element_property: str, override: dict):
    return {
        "overrideId": new_override_id(),
        "elementId": element_id,
        "elementProperty": element_property,
        "override": override,
    }


def get_val(layer: dict, key: str, default=None):
    raw = layer.get(key, default)
    if isinstance(raw, dict) and "value" in raw:
        return raw.get("value", default)
    return raw


def set_wrapped(layer: dict, key: str, value):
    current = layer.get(key)
    if isinstance(current, dict) and "value" in current:
        current["value"] = value
    else:
        layer[key] = value


def layer_id(layer: dict) -> str:
    return str(layer.get("id") or "")


def opt_value(opts: dict, key: str, default=None):
    raw = opts.get(key, default)
    if isinstance(raw, dict) and "value" in raw:
        return raw.get("value", default)
    return raw


def find_text_label(layers: list) -> tuple[dict | None, str]:
    for layer in layers:
        if layer.get("type") != "text":
            continue
        lid = layer_id(layer)
        if lid in (LABEL_IDLE_ID, "text0", "label") or lid.startswith("label"):
            if lid != LABEL_AIR_ID:
                return layer, lid
    for layer in layers:
        if layer.get("type") == "text" and layer_id(layer) != LABEL_AIR_ID:
            return layer, layer_id(layer)
    return None, ""


def look_label_var(look_id: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", str(look_id or "")).strip("_")[:64]
    return f"highascg_look_label_{slug or 'unknown'}"


def look_air_frame_var(look_id: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", str(look_id or "")).strip("_")[:64]
    return f"highascg_look_air_frame_{slug or 'unknown'}"


def build_preview_layer(layer_id: str, channel: int) -> dict:
    return {
        "id": layer_id,
        "name": f"Preview PGM ch{channel}" if "pgm" in layer_id else f"Preview PRV ch{channel}",
        "usage": "auto",
        "type": "image",
        "enabled": {"value": True, "isExpression": False},
        "opacity": 0,
        "x": {"value": 0, "isExpression": False},
        "y": {"value": 0, "isExpression": False},
        "width": {"value": 100, "isExpression": False},
        "height": {"value": 100, "isExpression": False},
        "rotation": {"value": 0, "isExpression": False},
        "base64Image": literal(None),
        "halign": {"value": "center", "isExpression": False},
        "valign": {"value": "center", "isExpression": False},
        "fillMode": {"value": "fit", "isExpression": False},
    }


def reorder_layers(layers: list) -> list:
    canvas = [l for l in layers if l.get("type") == "canvas"]
    images = [
        l
        for l in layers
        if l.get("type") == "image"
        and layer_id(l) not in (IDLE_BG_ID, "preview")
    ]
    boxes = [l for l in layers if l.get("type") == "box"]
    texts = [l for l in layers if l.get("type") == "text" and layer_id(l) != LABEL_AIR_ID]
    air = [l for l in layers if l.get("type") == "text" and layer_id(l) == LABEL_AIR_ID]
    other = [
        l
        for l in layers
        if l.get("type") not in ("canvas", "box", "image", "text")
    ]
    return canvas + images + boxes + texts + air + other


def build_label_air_from(label_layer: dict, look_id: str) -> dict:
    font = get_val(label_layer, "font", "companion-sans")
    return {
        "id": LABEL_AIR_ID,
        "name": "Label on air",
        "usage": "auto",
        "type": "text",
        "enabled": {"value": True, "isExpression": False},
        "opacity": 0,
        "x": {"value": 0, "isExpression": False},
        "y": {"value": LABEL_BOTTOM_Y, "isExpression": False},
        "width": {"value": 100, "isExpression": False},
        "height": {"value": LABEL_BOTTOM_H, "isExpression": False},
        "rotation": {"value": 0, "isExpression": False},
        "text": var_expr(look_label_var(look_id)),
        "color": {"value": 16777215, "isExpression": False},
        "halign": {"value": "center", "isExpression": False},
        "valign": {"value": "center", "isExpression": False},
        "fontsize": {"value": LABEL_ON_AIR_FONTSIZE, "isExpression": False},
        "fontsizeAllowShrink": {"value": False, "isExpression": False},
        "font": {"value": font, "isExpression": False},
        "outlineColor": {"value": 0, "isExpression": False},
    }


def label_on_air_override_additions():
    return [
        override_entry(LABEL_IDLE_ID, "opacity", literal(0)),
        override_entry("label", "opacity", literal(0)),
        override_entry("text0", "opacity", literal(0)),
        override_entry(LABEL_AIR_ID, "opacity", literal(100)),
        override_entry(LABEL_AIR_ID, "y", literal(LABEL_BOTTOM_Y)),
        override_entry(LABEL_AIR_ID, "height", literal(LABEL_BOTTOM_H)),
        override_entry(LABEL_AIR_ID, "fontsize", literal(LABEL_ON_AIR_FONTSIZE)),
        override_entry(LABEL_AIR_ID, "fontsizeAllowShrink", literal(False)),
        override_entry(LABEL_AIR_ID, "valign", literal("center")),
        override_entry(LABEL_AIR_ID, "color", literal(16777215)),
        override_entry(LABEL_AIR_ID, "outlineColor", literal(0)),
    ]


def compose_preview_var(channel: int) -> str:
    return f"highascg_compose_preview_ch{int(channel)}_image"


def tally_overrides(border_id: str, preview_layer_id: str, preview_channel: int):
    return label_on_air_override_additions() + [
        override_entry(
            preview_layer_id,
            "base64Image",
            var_expr(compose_preview_var(preview_channel)),
        ),
        override_entry(preview_layer_id, "opacity", literal(100)),
        override_entry(border_id, "opacity", literal(100)),
    ]


def merge_overrides(existing, additions):
    merged = {}
    for item in existing or []:
        key = f"{item.get('elementId')}\0{item.get('elementProperty')}"
        merged[key] = item
    for item in additions:
        key = f"{item['elementId']}\0{item['elementProperty']}"
        merged[key] = item
    return list(merged.values())


def strip_image_and_stale(overrides: list) -> list:
    drop = {
        (LABEL_IDLE_ID, "valign"),
        (LABEL_IDLE_ID, "y"),
        (LABEL_IDLE_ID, "height"),
        ("preview", "base64Image"),
        ("preview", "opacity"),
        ("preview_pgm", "base64Image"),
        ("preview_prv", "base64Image"),
    }
    out = []
    for item in overrides or []:
        key = (item.get("elementId"), item.get("elementProperty"))
        if key in drop:
            continue
        if item.get("elementProperty") == "base64Image":
            continue
        if item.get("elementId") == IDLE_BG_ID:
            continue
        if item.get("elementId") == "label_air_bg":
            continue
        out.append(item)
    return out


def extract_look_id_from_layers(layers: list) -> str:
    for layer in layers:
        if layer_id(layer) != LABEL_AIR_ID:
            continue
        raw = layer.get("text")
        val = raw.get("value") if isinstance(raw, dict) else raw
        if not val:
            continue
        m = re.search(r"highascg_look_label_(sc_[A-Za-z0-9_]+)", str(val))
        if m:
            return m.group(1)
    return ""


def extract_look_id(control: dict) -> str:
    layers = (control.get("style") or {}).get("layers") or []
    from_layers = extract_look_id_from_layers(layers)
    if from_layers:
        return from_layers
    for lv in control.get("localVariables") or []:
        if lv.get("variableName") != "look_id":
            continue
        sv = lv.get("startupValue")
        if sv is not None and str(sv).strip() and str(sv).strip() not in ("unknown", "$(local:look_id)"):
            if not str(sv).strip().startswith("$("):
                return str(sv).strip()
    for fb in control.get("feedbacks") or []:
        fid = fb.get("definitionId") or fb.get("feedbackId")
        if fid not in LOOK_FEEDBACKS and fid != "look_live_preview_for_screen":
            continue
        val = opt_value(fb.get("options") or {}, "look_id", "")
        if val and not str(val).strip().startswith("$("):
            return str(val).strip()
    step = (control.get("steps") or {}).get("0") or {}
    for act in (step.get("action_sets") or {}).get("down") or []:
        if (act.get("definitionId") or act.get("actionId")) != "look_take":
            continue
        val = opt_value(act.get("options") or {}, "look_id", "")
        if val and not str(val).strip().startswith("$("):
            return str(val).strip()
    return ""


def extract_screen_index(control: dict) -> int:
    for lv in control.get("localVariables") or []:
        if lv.get("variableName") != "screen_index":
            continue
        sv = lv.get("startupValue")
        try:
            return max(0, int(sv if sv is not None else 0))
        except (TypeError, ValueError):
            pass
    for fb in control.get("feedbacks") or []:
        fid = fb.get("definitionId") or fb.get("feedbackId")
        if fid not in LOOK_FEEDBACKS and fid != "look_live_preview_for_screen":
            continue
        val = opt_value(fb.get("options") or {}, "screen_index", 0)
        if isinstance(val, str) and val.strip().startswith("$("):
            continue
        try:
            return max(0, int(val or 0))
        except (TypeError, ValueError):
            return 0
    step = (control.get("steps") or {}).get("0") or {}
    for act in (step.get("action_sets") or {}).get("down") or []:
        if (act.get("definitionId") or act.get("actionId")) != "look_take":
            continue
        val = opt_value(act.get("options") or {}, "screen_index", 0)
        if isinstance(val, str) and val.strip().startswith("$("):
            continue
        try:
            return max(0, int(val or 0))
        except (TypeError, ValueError):
            return 0
    return 0


def feedback_options(screen_index: int) -> dict:
    return {
        "look_id": expr(LOCAL_LOOK_ID),
        "screen_index": literal(screen_index),
    }


def patch_control(control: dict, channel_map: dict) -> bool:
    if control.get("type") != "button-layered":
        return False
    feedbacks = control.get("feedbacks") or []
    if not any(
        (fb.get("definitionId") or fb.get("feedbackId")) in LOOK_FEEDBACKS
        for fb in feedbacks
    ):
        return False

    layers = (control.get("style") or {}).get("layers")
    if not isinstance(layers, list):
        return False

    label_layer, _ = find_text_label(layers)
    if not label_layer:
        return False

    look_id = extract_look_id(control)
    if not look_id:
        look_id = extract_look_id_from_layers(layers)
    screen_index = extract_screen_index(control)
    pgm_ch, prv_ch = channels_for_screen(channel_map, screen_index)

    control["localVariables"] = [
        {
            "variableName": "look_id",
            "variableType": "simple",
            "startupValue": look_id or "unknown",
            "headline": "Look id (take action + PGM/PRV feedbacks)",
        },
        {
            "variableName": "screen_index",
            "variableType": "simple",
            "startupValue": screen_index,
            "headline": "Screen index (routing for take + feedbacks)",
        },
    ]

    layers[:] = [
        l
        for l in layers
        if layer_id(l)
        not in (IDLE_BG_ID, "preview", "preview_pgm", "preview_prv", "label_air_bg")
    ]
    layers.insert(1, build_preview_layer("preview_pgm", pgm_ch))
    if prv_ch is not None:
        layers.insert(2, build_preview_layer("preview_prv", prv_ch))

    set_wrapped(label_layer, "valign", "center")
    set_wrapped(label_layer, "halign", "center")
    set_wrapped(label_layer, "y", 0)
    set_wrapped(label_layer, "height", 100)
    if look_id:
        label_layer["text"] = var_expr(look_label_var(look_id))

    air = next((l for l in layers if layer_id(l) == LABEL_AIR_ID), None)
    if air is None and look_id:
        layers.append(build_label_air_from(label_layer, look_id))
    elif air is not None:
        set_wrapped(air, "color", 16777215)
        set_wrapped(air, "outlineColor", 0)

    for layer in layers:
        if layer.get("type") == "box":
            set_wrapped(layer, "color", TRANSPARENT_FILL)
            set_wrapped(layer, "borderWidth", BORDER_WIDTH)
            set_wrapped(layer, "borderPosition", "inside")

    control["style"]["layers"] = reorder_layers(layers)

    feedbacks = [
        fb
        for fb in feedbacks
        if (fb.get("definitionId") or fb.get("feedbackId"))
        != "look_live_preview_for_screen"
    ]

    opts = feedback_options(screen_index)
    for fb in feedbacks:
        fid = fb.get("definitionId") or fb.get("feedbackId")
        if fid not in LOOK_FEEDBACKS:
            continue
        fb["options"] = {**opts, **(fb.get("options") or {})}
        fb["options"]["look_id"] = literal(look_id) if look_id else expr(LOCAL_LOOK_ID)
        fb["options"]["screen_index"] = literal(screen_index)
        overrides = strip_image_and_stale(fb.get("styleOverrides") or [])
        if fid == "look_on_pgm":
            fb["styleOverrides"] = merge_overrides(
                overrides, tally_overrides("pgm_border", "preview_pgm", pgm_ch)
            )
        elif fid == "look_on_prv_for_screen":
            fb["styleOverrides"] = merge_overrides(
                overrides, tally_overrides("prv_border", "preview_prv", prv_ch or pgm_ch)
            )

    step = (control.get("steps") or {}).get("0") or {}
    downs = (step.get("action_sets") or {}).get("down") or []
    for act in downs:
        if (act.get("definitionId") or act.get("actionId")) != "look_take":
            continue
        act_opts = act.get("options") or {}
        act["options"] = {
            **act_opts,
            "look_id": expr(LOCAL_LOOK_ID),
            "screen_index": expr(LOCAL_SCREEN_INDEX),
        }

    control["feedbacks"] = feedbacks
    return True


def main() -> int:
    if not DB.is_file():
        print(f"Database not found: {DB}", file=sys.stderr)
        return 1

    channel_map = fetch_channel_map()
    print(f"Channel map: PGM={channel_map.get('programChannels')} PRV={channel_map.get('previewChannels')}")

    backup = DB.with_suffix(
        f".sqlite.bak-look-local-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    )
    shutil.copy2(DB, backup)
    print(f"Backup: {backup}")

    conn = sqlite3.connect(str(DB))
    global CONNECTION_LABEL
    CONNECTION_LABEL = resolve_connection_label(conn)
    print(f"Using connection label for expressions: {CONNECTION_LABEL}")
    cur = conn.cursor()
    cur.execute("SELECT id, value FROM controls WHERE id LIKE 'bank:%'")
    rows = cur.fetchall()
    patched = 0
    for bank_id, raw in rows:
        control = json.loads(raw)
        if patch_control(control, channel_map):
            cur.execute(
                "UPDATE controls SET value = ? WHERE id = ?",
                (json.dumps(control, separators=(",", ":")), bank_id),
            )
            patched += 1
            print(f"Patched {bank_id}")

    conn.commit()
    conn.close()
    print(f"Done: {patched} look button(s). Restart Companion.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
