/**
 * @file wol-actions.js
 * Wake-on-LAN actions and helpers for sending magic packets.
 */

import dgram from "dgram";

/**
 * Build a 102-byte WoL magic packet.
 * Format: 6×0xFF + 16 repetitions of the MAC address (6 bytes).
 *
 * @param {string} mac - MAC address in format AA:BB:CC:DD:EE:FF (: or - separators, or no separators)
 * @returns {Buffer} 102-byte magic packet
 * @throws {Error} if MAC is invalid
 */
export function buildWolPacket(mac) {
  const cleanMac = String(mac || "")
    .trim()
    .replace(/[:-]/g, "");

  if (!/^[0-9A-Fa-f]{12}$/.test(cleanMac)) {
    throw new Error(`Invalid MAC address: ${mac}`);
  }

  const macBytes = [];
  for (let i = 0; i < 12; i += 2) {
    macBytes.push(parseInt(cleanMac.substring(i, i + 2), 16));
  }

  const packet = Buffer.alloc(102);
  // First 6 bytes: 0xFF
  for (let i = 0; i < 6; i++) {
    packet[i] = 0xff;
  }
  // Repeat MAC address 16 times
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 6; j++) {
      packet[6 + i * 6 + j] = macBytes[j];
    }
  }

  return packet;
}

/**
 * Send WoL magic packet via UDP broadcast.
 * Sends the packet 3 times with 100ms spacing.
 *
 * @param {string} mac - Target MAC address
 * @param {string} broadcast - Broadcast address (e.g., "255.255.255.255")
 * @param {number} port - UDP port (default 9)
 * @returns {Promise<void>}
 */
export async function sendWol(mac, broadcast, port) {
  const packet = buildWolPacket(mac);
  const socket = dgram.createSocket("udp4");

  return new Promise((resolve, reject) => {
    socket.on("error", (err) => {
      socket.close();
      reject(err);
    });

    socket.bind(undefined, () => {
      socket.setBroadcast(true);

      let sent = 0;
      const sendPacket = () => {
        socket.send(packet, 0, packet.length, port, broadcast, (err) => {
          if (err) {
            socket.close();
            reject(err);
            return;
          }

          sent += 1;
          if (sent < 3) {
            setTimeout(sendPacket, 100);
          } else {
            socket.close();
            resolve();
          }
        });
      };

      sendPacket();
    });
  });
}

/**
 * WoL actions.
 * @param {import('../instance.js').HighAsCGInstance} instance
 */
export default function (instance) {
  return {
    wol_wake_stored: {
      name: "Wake on LAN: stored target",
      options: [],
      callback: async (_action) => {
        const { wol_mac, wol_broadcast, wol_port } = instance.config;

        if (!wol_mac || String(wol_mac).trim() === "") {
          instance.log("error", "WoL action: wol_mac not configured");
          return;
        }

        try {
          await sendWol(
            wol_mac,
            String(wol_broadcast || "255.255.255.255").trim(),
            Number(wol_port || 9),
          );
          instance.log("info", `WoL: sent magic packet to ${wol_mac}`);
        } catch (err) {
          instance.log("error", `WoL action error: ${err.message || err}`);
        }
      },
    },

    wol_wake_mac: {
      name: "Wake on LAN: by MAC",
      options: [
        {
          type: "textinput",
          label: "MAC Address",
          id: "mac",
          default: "",
          regex: /^([0-9A-Fa-f]{2}[:-]?){5}[0-9A-Fa-f]{2}$/,
        },
        {
          type: "textinput",
          label: "Broadcast Address",
          id: "broadcast",
          default: "255.255.255.255",
        },
        {
          type: "number",
          label: "Port",
          id: "port",
          default: 9,
          min: 1,
          max: 65535,
        },
      ],
      callback: async (action) => {
        const { mac, broadcast, port } = action.options;

        if (!mac || String(mac).trim() === "") {
          instance.log("error", "WoL action: MAC not specified");
          return;
        }

        try {
          await sendWol(
            String(mac).trim(),
            String(broadcast || "255.255.255.255").trim(),
            Number(port || 9),
          );
          instance.log("info", `WoL: sent magic packet to ${mac}`);
        } catch (err) {
          instance.log("error", `WoL action error: ${err.message || err}`);
        }
      },
    },
  };
}
