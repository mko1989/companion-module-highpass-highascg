import { TCPHelper, InstanceStatus } from "@companion-module/base";
import { getAmcpPort } from "./host-target.js";

class HighAsCGTcp {
  constructor(instance) {
    this.instance = instance;
    this.socket = null;
    this.connected = false;
    this.init();
  }

  init() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    const host = this.instance.getActiveHost?.() || this.instance.config.box_host;
    if (host) {
      this.socket = new TCPHelper(host, getAmcpPort(this.instance.config));

      this.socket.on("status_change", (status, message) => {
        this.instance.updateStatus(status, message);
      });

      this.socket.on("error", (err) => {
        this.instance.log("error", `Network error: ${err.message}`);
        this.connected = false;
        this.instance.connectionRouter?.notifyBridgeDisconnected();
      });

      this.socket.on("connect", () => {
        this.instance.log("debug", "Connected to CasparCG direct TCP");
        this.connected = true;
        this.instance.updateStatus(InstanceStatus.Ok);
        this.sendCommand("VERSION"); // Just to verify
      });

      this.socket.on("data", (data) => {
        // We don't necessarily need to parse full responses for direct actions here
        // unless we want to populate direct variables.
        // For now, just debug log.
        this.instance.log("debug", `Caspar raw data: ${data.toString()}`);
      });
    }
  }

  sendCommand(cmd) {
    if (this.socket && this.connected) {
      this.instance.log("debug", `Sending AMCP: ${cmd}`);
      this.socket.send(cmd + "\r\n");
    } else {
      this.instance.log("warn", `Socket not connected, cannot send: ${cmd}`);
    }
  }

  destroy() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }
}

export { HighAsCGTcp };
