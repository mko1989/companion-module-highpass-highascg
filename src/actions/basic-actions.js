/**
 * @file basic-actions.js
 * Raw AMCP escape hatch — the ONLY direct-AMCP surface left (WO-394).
 *
 * Sent via the HighAsCG app (`POST /api/amcp/raw`), not a direct Caspar socket: the app
 * normalizes the line, tracks playback state, and the request follows hot-backup failover.
 */

export default function (instance) {
  return {
    raw: {
      name: "Raw AMCP Command (via HighAsCG)",
      options: [
        { type: "textinput", label: "Command", id: "cmd", default: "" },
      ],
      callback: async (action) => {
        const cmd = String(action.options.cmd || "").trim();
        if (!cmd) return;
        if (!instance.bridge?.api) {
          instance.log("warn", `Bridge not connected, cannot send: ${cmd}`);
          return;
        }
        try {
          await instance.bridge.api.amcpRaw(cmd);
        } catch (e) {
          instance.log("error", `Raw AMCP: ${e.message || e}`);
        }
      },
    },
  };
}
