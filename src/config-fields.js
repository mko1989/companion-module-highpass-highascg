import { Regex } from "@companion-module/base";

/**
 * An IP, or nothing at all.
 *
 * `isVisible` hides a field but does NOT exempt it from validation, and an empty string fails
 * `Regex.IP` — so an optional IP field with a regex blocks Save for everyone who does not use the
 * feature (owner 2026-07-29: "i cant save the config of the module, because i have nothing in the
 * backup ip. even though i dont have a backup and dont want to use it now").
 *
 * Companion's `Regex.*` constants are STRINGS in `/…/` form, not RegExp objects — hence the slice
 * rather than `.source` (which would silently yield `/^$|undefined/`, i.e. accept only empty).
 */
const OPTIONAL_IP = `/^$|${Regex.IP.slice(1, -1)}/`;

/**
 * WO-394: this is a HighAsCG module — no AMCP port, no bridge on/off switch. The HTTP/WS
 * bridge to the app IS the module; raw AMCP goes through the app's /api/amcp/raw.
 */
export default function () {
  return [
    {
      type: "static-text",
      id: "info",
      width: 12,
      label: "Information",
      value:
        "Controls a HighAsCG playout box over its HTTP REST + WebSocket bridge: looks, timelines, scene take, stream/record outputs, timers.",
    },
    {
      type: "textinput",
      id: "box_host",
      label: "Box Host",
      width: 6,
      default: "127.0.0.1",
      regex: Regex.IP,
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
      type: "secret-text",
      id: "api_password",
      label: "HighAsCG password",
      width: 6,
      default: "",
      description:
        "The box's shared API password. Leave empty while API authentication is off.",
      tooltip:
        "The box's shared API password. Leave empty while API authentication is off.",
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
      // Optional: empty is valid, so the config saves with Hot Backup off. Failover already
      // requires BOTH the flag and a non-empty host (host-target.js:31-32).
      regex: OPTIONAL_IP,
      isVisible: (cfg) => !!cfg.hot_backup_enabled,
    },
  ];
}
