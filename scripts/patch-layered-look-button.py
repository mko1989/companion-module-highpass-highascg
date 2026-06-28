#!/usr/bin/env python3
"""
Patch layered look button styling: transparent border box, label on-air/off-air sizing.

Default target: page 1/2/2 button (bank:yDvLTXCT5RNqC1Rq9IGVk).
"""
from __future__ import annotations

import json
import re
import secrets
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DB = Path("/home/casparcg/.config/companion/v5.0/db.sqlite")
BANK_ID = "bank:yDvLTXCT5RNqC1Rq9IGVk"
MODULE = "highpass-highascg"
PGM_VAR = "highascg_compose_preview_ch1_image"
PRV_VAR = "highascg_compose_preview_ch2_image"
IMAGE_ID = "image0"
BOX_ID = "box0"
TEXT_ID = "text0"
LABEL = "Look 1 Scr 1"

TRANSPARENT_FILL = 4278190080
BORDER_WIDTH = 4
LABEL_IDLE_FONTSIZE = 24
LABEL_ON_AIR_FONTSIZE = 18
LABEL_BOTTOM_Y = 78
LABEL_BOTTOM_H = 22


def literal(value):
    return {"isExpression": False, "value": value}


def var_expr(var_id: str):
    return {"isExpression": True, "value": f"$({MODULE}:{var_id})"}


def new_override_id() -> str:
    return secrets.token_urlsafe(16)[:21]


def override_entry(element_id: str, element_property: str, override: dict):
    return {
        "overrideId": new_override_id(),
        "elementId": element_id,
        "elementProperty": element_property,
        "override": override,
    }


def single_line(text: str) -> str:
    return re.sub(r"\s*\n+\s*", " ", str(text or "")).strip()


def set_wrapped(layer: dict, key: str, value):
    current = layer.get(key)
    if isinstance(current, dict) and "value" in current:
        current["value"] = value
    else:
        layer[key] = value


def patch_box_layer(layer: dict):
    if layer.get("id") != BOX_ID or layer.get("type") != "box":
        return False
    set_wrapped(layer, "color", TRANSPARENT_FILL)
    set_wrapped(layer, "borderWidth", BORDER_WIDTH)
    set_wrapped(layer, "borderPosition", "inside")
    return True


def patch_text_idle(layer: dict):
    if layer.get("id") != TEXT_ID or layer.get("type") != "text":
        return False
    set_wrapped(layer, "valign", "center")
    set_wrapped(layer, "halign", "center")
    set_wrapped(layer, "y", 0)
    set_wrapped(layer, "height", 100)
    set_wrapped(layer, "fontsize", LABEL_IDLE_FONTSIZE)
    set_wrapped(layer, "fontsizeAllowShrink", True)
    return True


def image_overrides(var_id: str):
    return [
        override_entry(IMAGE_ID, "opacity", literal(100)),
        override_entry(IMAGE_ID, "base64Image", var_expr(var_id)),
    ]


def label_on_air_overrides():
    text = single_line(LABEL)
    return [
        override_entry(TEXT_ID, "valign", literal("bottom")),
        override_entry(TEXT_ID, "halign", literal("center")),
        override_entry(TEXT_ID, "y", literal(LABEL_BOTTOM_Y)),
        override_entry(TEXT_ID, "height", literal(LABEL_BOTTOM_H)),
        override_entry(TEXT_ID, "fontsize", literal(LABEL_ON_AIR_FONTSIZE)),
        override_entry(TEXT_ID, "fontsizeAllowShrink", literal(True)),
        override_entry(TEXT_ID, "text", literal(text)),
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


def find_layers(control: dict):
    style = control.get("style") or {}
    if isinstance(style.get("layers"), list):
        return style["layers"]
    return None


def patch_image_layer_idle(layers):
    for layer in layers:
        if layer.get("id") == IMAGE_ID and layer.get("type") == "image":
            set_wrapped(layer, "opacity", 0)
            layer["base64Image"] = None
            return True
    return False


def patch_feedbacks(feedbacks):
    if not isinstance(feedbacks, list):
        return False
    changed = False
    for fb in feedbacks:
        fid = fb.get("definitionId") or fb.get("feedbackId")
        overrides = list(fb.get("styleOverrides") or [])
        if fid == "look_on_pgm":
            fb["styleOverrides"] = merge_overrides(
                overrides, image_overrides(PGM_VAR) + label_on_air_overrides()
            )
            changed = True
        elif fid == "look_on_prv_for_screen":
            fb["styleOverrides"] = merge_overrides(
                overrides, image_overrides(PRV_VAR) + label_on_air_overrides()
            )
            changed = True
    return changed


def main() -> int:
    if not DB.is_file():
        print(f"Database not found: {DB}", file=sys.stderr)
        return 1

    backup = DB.with_suffix(
        f".sqlite.bak-look-style-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    )
    shutil.copy2(DB, backup)
    print(f"Backup: {backup}")

    conn = sqlite3.connect(str(DB))
    cur = conn.cursor()
    cur.execute("SELECT value FROM controls WHERE id = ?", (BANK_ID,))
    row = cur.fetchone()
    if not row:
        print(f"Control not found: {BANK_ID}", file=sys.stderr)
        return 1

    control = json.loads(row[0])
    layers = find_layers(control)
    if layers is None:
        print("No layered style.layers found on control", file=sys.stderr)
        return 1

    box_ok = any(patch_box_layer(layer) for layer in layers)
    text_ok = any(patch_text_idle(layer) for layer in layers)
    idle_ok = patch_image_layer_idle(layers)
    fb_ok = patch_feedbacks(control.get("feedbacks"))

    cur.execute(
        "UPDATE controls SET value = ? WHERE id = ?",
        (json.dumps(control, separators=(",", ":")), BANK_ID),
    )
    conn.commit()
    conn.close()

    print(f"Patched {BANK_ID}")
    print(f"  box0 transparent fill + borderWidth {BORDER_WIDTH}: {box_ok}")
    print(f"  text0 idle center fontsize {LABEL_IDLE_FONTSIZE}: {text_ok}")
    print(f"  image0 idle hidden: {idle_ok}")
    print(f"  feedback label fontsize {LABEL_ON_AIR_FONTSIZE} at bottom: {fb_ok}")
    print("Restart Companion to reload the button.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
