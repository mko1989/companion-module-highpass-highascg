#!/usr/bin/env python3
"""
Add PGM/PRV outer-edge bars to existing quadrant compose-preview layered buttons.
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
EDGE_PCT = 4
PGM_COLOR = 14417920  # combineRgb(220, 0, 0)
PRV_COLOR = 46080  # combineRgb(0, 180, 0)
NEUTRAL_COLOR = 7895160  # combineRgb(120, 120, 120)


def literal(value):
    return {"value": value, "isExpression": False}


def new_layer_id() -> str:
    return secrets.token_urlsafe(12)[:16]


def get_val(layer: dict, key: str, default=None):
    raw = layer.get(key, default)
    if isinstance(raw, dict) and "value" in raw:
        return raw.get("value", default)
    return raw


def parse_quad_var(value: str):
    m = re.search(
        r"compose_preview_ch(\d+)_quad_(tl|tr|bl|br)",
        str(value or ""),
        re.I,
    )
    if not m:
        return None
    return int(m.group(1)), m.group(2).lower()


def edge_bars(quadrant: str, color: int):
    t = EDGE_PCT
    inner = 100 - t
    bars = []

    def bar(suffix, x, y, width, height):
        return {
            "id": new_layer_id(),
            "name": f"edge_{suffix}",
            "usage": "auto",
            "type": "box",
            "enabled": literal(True),
            "opacity": literal(100),
            "x": literal(x),
            "y": literal(y),
            "width": literal(width),
            "height": literal(height),
            "rotation": literal(0),
            "color": literal(color),
            "borderWidth": literal(0),
        }

    if quadrant in ("tl", "tr"):
        bars.append(bar("top", 0, 0, 100, t))
    if quadrant in ("bl", "br"):
        bars.append(bar("bottom", 0, inner, 100, t))
    if quadrant in ("tl", "bl"):
        bars.append(bar("left", 0, 0, t, 100))
    if quadrant in ("tr", "br"):
        bars.append(bar("right", inner, 0, t, 100))
    return bars


def channel_color(channel: int) -> int:
    # Typical HighAsCG default: odd-ish program, even preview pairs.
    # Without live channel map in DB, use ch1/ch3/... red, ch2/ch4/... green.
    if channel % 2 == 1:
        return PGM_COLOR
    return PRV_COLOR


def patch_control(control: dict) -> bool:
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
    if any(str(l.get("name", "")).startswith("edge_") for l in layers if l.get("type") == "box"):
        return False

    color = channel_color(channel)
    layers.extend(edge_bars(quadrant, color))
    control["style"]["layers"] = layers
    return True


def main() -> int:
    if not DB.is_file():
        print(f"Database not found: {DB}", file=sys.stderr)
        return 1

    backup = DB.with_suffix(
        f".sqlite.bak-quad-edges-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    )
    shutil.copy2(DB, backup)
    print(f"Backup: {backup}")

    conn = sqlite3.connect(str(DB))
    cur = conn.cursor()
    cur.execute("SELECT id, value FROM controls WHERE id LIKE 'bank:%'")
    patched = 0
    for bank_id, raw in cur.fetchall():
        control = json.loads(raw)
        if patch_control(control):
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
