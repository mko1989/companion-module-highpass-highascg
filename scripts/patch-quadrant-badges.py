#!/usr/bin/env python3
"""
Add PGM/PRV + SCR n seam-safe badges to existing quadrant compose-preview buttons (WO-72).
"""
from __future__ import annotations

import json
import re
import shutil
import sqlite3
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

DB = Path("/home/casparcg/.config/companion/v5.0/db.sqlite")

BADGE_X = -20
BUS_BADGE_X = 20
BADGE_Y = 56
BADGE_W = 100
BADGE_H = 50
BADGE_FONTSIZE = 40

WHITE = 16777215
BLACK = 0
PGM_OUTLINE = 14417920  # rgb(220,0,0)
PRV_OUTLINE = 46080  # rgb(0,180,0)


def literal(value):
    return {"isExpression": False, "value": value}


def fetch_channel_map() -> dict:
    try:
        with urllib.request.urlopen("http://127.0.0.1:4200/api/state", timeout=2) as resp:
            data = json.loads(resp.read().decode())
            return data.get("channelMap") or {}
    except OSError:
        return {"programChannels": [1, 3], "previewChannels": [2, None]}


def resolve_bus(channel: int, cm: dict) -> tuple[str, int] | None:
    pgm = cm.get("programChannels") or []
    prv = cm.get("previewChannels") or []
    for i, raw in enumerate(pgm):
        if int(raw or 0) == channel:
            return "PGM", PGM_OUTLINE
    for i, raw in enumerate(prv):
        p = raw
        if p in (None, "", 0):
            continue
        if int(p) == channel:
            g = int(pgm[i]) if i < len(pgm) and pgm[i] else 0
            if int(p) != g:
                return "PRV", PRV_OUTLINE
    return None


def resolve_screen_index(channel: int, cm: dict) -> int:
    pgm = cm.get("programChannels") or []
    prv = cm.get("previewChannels") or []
    length = max(len(pgm), len(prv), 1)
    for i in range(length):
        if i < len(pgm) and int(pgm[i] or 0) == channel:
            return i
        if i < len(prv) and prv[i] not in (None, "", 0) and int(prv[i]) == channel:
            return i
    return 0


def parse_quad_var(value: str):
    m = re.search(
        r"compose_preview_ch(\d+)_quad_(tl|tr|bl|br)",
        str(value or ""),
        re.I,
    )
    if not m:
        return None
    return int(m.group(1)), m.group(2).lower()


def build_text_layer(layer_id: str, name: str, text: str, outline: int):
    x = BUS_BADGE_X if layer_id == "bus_badge" else BADGE_X
    return {
        "id": layer_id,
        "name": name,
        "usage": "auto",
        "type": "text",
        "enabled": literal(True),
        "opacity": literal(100),
        "x": literal(x),
        "y": literal(BADGE_Y),
        "width": literal(BADGE_W),
        "height": literal(BADGE_H),
        "rotation": literal(0),
        "text": literal(text),
        "color": literal(WHITE),
        "outlineColor": literal(outline),
        "fontsize": literal(BADGE_FONTSIZE),
        "fontsizeAllowShrink": literal(False),
        "font": literal("companion-sans"),
        "halign": literal("left" if layer_id == "bus_badge" else "right"),
        "valign": literal("center"),
    }


def patch_control(control: dict, cm: dict) -> bool:
    if control.get("type") != "button-layered":
        return False
    layers = (control.get("style") or {}).get("layers")
    if not isinstance(layers, list):
        return False

    preview = next((l for l in layers if l.get("type") == "image"), None)
    if not preview:
        return False
    img = preview.get("base64Image")
    var_val = img.get("value") if isinstance(img, dict) else img
    parsed = parse_quad_var(var_val)
    if not parsed:
        return False

    channel, quadrant = parsed
    changed = False

    layers[:] = [l for l in layers if str(l.get("id") or "") not in ("bus_badge", "screen_badge")]

    if quadrant == "bl":
        bus = resolve_bus(channel, cm)
        if bus:
            label, outline = bus
            layers.append(
                build_text_layer(
                    "bus_badge",
                    "Bus badge",
                    label,
                    outline,
                )
            )
            changed = True
    elif quadrant == "br":
        screen_idx = resolve_screen_index(channel, cm)
        layers.append(
            build_text_layer(
                "screen_badge",
                "Screen badge",
                f"SCR {screen_idx + 1}",
                BLACK,
            )
        )
        changed = True

    if changed:
        control["style"]["layers"] = layers
    return changed


def main() -> int:
    if not DB.is_file():
        print(f"Database not found: {DB}", file=sys.stderr)
        return 1

    cm = fetch_channel_map()
    print(f"Channel map: PGM={cm.get('programChannels')} PRV={cm.get('previewChannels')}")

    backup = DB.with_suffix(
        f".sqlite.bak-quad-badges-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    )
    shutil.copy2(DB, backup)
    print(f"Backup: {backup}")

    conn = sqlite3.connect(str(DB))
    cur = conn.cursor()
    cur.execute("SELECT id, value FROM controls WHERE id LIKE 'bank:%'")
    patched = 0
    for bank_id, raw in cur.fetchall():
        control = json.loads(raw)
        if patch_control(control, cm):
            cur.execute(
                "UPDATE controls SET value = ? WHERE id = ?",
                (json.dumps(control, separators=(",", ":")), bank_id),
            )
            patched += 1
            print(f"Patched {bank_id}")

    conn.commit()
    conn.close()
    print(f"Done: {patched} quadrant button(s). Restart Companion.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
