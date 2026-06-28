import { Regex } from "@companion-module/base";

export default function () {
  return [
    {
      type: "static-text",
      id: "info",
      width: 12,
      label: "Information",
      value:
        "CasparCG and the HighAsCG app run side-by-side on the same machine — one host IP covers both AMCP and the HTTP/WebSocket bridge.",
    },
    {
      type: "textinput",
      id: "box_host",
      label: "Box Host (Caspar + HighAsCG)",
      width: 6,
      default: "127.0.0.1",
      regex: Regex.IP,
    },
    {
      type: "number",
      id: "port",
      label: "AMCP Port",
      width: 3,
      default: 5250,
      min: 1,
      max: 65535,
    },
    {
      type: "number",
      id: "highascg_port",
      label: "HighAsCG HTTP Port",
      width: 3,
      default: 4200,
      min: 1,
      max: 65535,
    },
    {
      type: "static-text",
      id: "sep_bridge",
      width: 12,
      value: "---",
    },
    {
      type: "static-text",
      id: "highascg_header",
      width: 12,
      label: "HighAsCG App Bridge",
      value:
        "HTTP REST + WebSocket on the HTTP port above. Enables variables, looks/timeline actions, and scene take.",
    },
    {
      type: "static-text",
      id: "highascg_preview_help",
      width: 12,
      label: "Compose preview button images",
      value:
        "1) HighAsCG Settings: enable Companion preview variables. 2) Bridge ON. 3) Re-drag Compose preview presets after reload.",
      isVisible: (cfg) => !!cfg.highascg_enabled,
    },
    {
      type: "checkbox",
      id: "highascg_enabled",
      label: "Use HighAsCG Bridge",
      width: 12,
      default: true,
    },
    {
      type: "checkbox",
      id: "compose_preview_buttons_enabled",
      label: "Compose preview on Stream Deck buttons",
      width: 12,
      default: true,
      isVisible: (cfg) => !!cfg.highascg_enabled,
    },
    {
      type: "static-text",
      id: "compose_preview_traffic_help",
      width: 12,
      label: "Compose preview traffic",
      value:
        "When enabled, live JPEG variables update button images (~0.5–1.5 Mbps per active channel over WebSocket). Disable to keep actions/looks only.",
      isVisible: (cfg) => !!cfg.highascg_enabled,
    },
    {
      type: "static-text",
      id: "compose_mosaic_help",
      width: 12,
      label: "Custom mosaic layouts (5×4 walls, etc.)",
      value:
        "Not in this module version yet (WO-72 Phase D). Use the built-in 2×2 quadrant presets per channel for now.",
      isVisible: (cfg) => !!cfg.highascg_enabled,
    },
    {
      type: "static-text",
      id: "sep_hot_backup",
      width: 12,
      value: "---",
    },
    {
      type: "static-text",
      id: "hot_backup_header",
      width: 12,
      label: "Hot Backup",
      value:
        "Pair a backup box in HighAsCG Device View. Companion sends actions to the main box while it is reachable; on disconnect, traffic fails over to the backup host automatically.",
    },
    {
      type: "checkbox",
      id: "hot_backup_enabled",
      label: "Enable Hot Backup",
      width: 12,
      default: false,
    },
    {
      type: "textinput",
      id: "backup_host",
      label: "Backup Box Host",
      width: 6,
      default: "",
      regex: Regex.IP,
      isVisible: (cfg) => !!cfg.hot_backup_enabled,
    },
  ];
}
