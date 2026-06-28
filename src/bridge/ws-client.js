import WebSocket from "ws";
import { getBridgePort } from "../host-target.js";

class HighAsCGWs {
  constructor(instance) {
    this.instance = instance;
    this.ws = null;
    this.reconnectTimer = null;
    this.init();
  }

  init() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }

    const host = this.instance.getActiveHost();
    if (!host) return;

    const url = `ws://${host}:${getBridgePort(this.instance.config)}/api/ws`;
    this.instance.log("debug", `Connecting to HighAsCG WS: ${url}`);
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.instance.log("debug", "Connected to HighAsCG WebSocket bridge");
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const t = msg.type;
        if (t === "state" && msg.data) {
          this.instance.handleBridgeState(msg.data);
        } else if (t === "variable_update" && msg.data && typeof msg.data === "object") {
          this.instance.updateVariablesFromBridge(msg.data);
        } else if (t === "selection_sync" && msg.data && typeof msg.data === "object") {
          const d = msg.data;
          const flat =
            Object.keys(d).some((k) => String(k).startsWith("ui_selection_"));
          if (flat) {
            this.instance.updateVariablesFromBridge(d);
          }
        } else if (
          (t === "scene_deck_sync" ||
            t === "scene.deck_sync" ||
            t === "scene_deck" ||
            t === "scene.deck") &&
          msg.data &&
          typeof msg.data === "object"
        ) {
          if (typeof this.instance.applySceneDeck === "function") {
            this.instance.applySceneDeck(msg.data);
          }
        } else if (t === "project_sync" && msg.data && typeof msg.data === "object") {
          if (typeof this.instance.applyProjectSync === "function") {
            this.instance.applyProjectSync(msg.data);
          }
        } else if (t === "timeline.playback" && msg.data) {
          this.instance.handleBridgeState({
            timeline: { playback: msg.data },
          });
        } else if (t === "timeline.tick" && msg.data) {
          this.instance.handleBridgeState({
            timeline: { tick: msg.data },
          });
        } else if (t === "compose.preview" && msg.data?.channel != null) {
          if (this.ws?.readyState !== 1) {
            this.instance.bridge?.previewPoller?.scheduleFetch(msg.data.channel);
          }
        } else if (t === "change" && msg.data && msg.data.path != null) {
          const path = String(msg.data.path);
          if (path === "scene.live") {
            this.instance.handleBridgeState({ scene: { live: msg.data.value } });
          } else if (
            path === "scene.deck" ||
            path === "scene_deck" ||
            path === "scene/deck"
          ) {
            if (typeof this.instance.applySceneDeck === "function") {
              this.instance.applySceneDeck(msg.data.value);
            }
          }
        }
      } catch (err) {
        this.instance.log("error", `HighAsCG WS Parse Error: ${err.message}`);
      }
    });

    this.ws.on("close", () => {
      this.instance.log("debug", "HighAsCG WS closed, reconnecting...");
      this.instance.connectionRouter?.notifyBridgeDisconnected();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.instance.log("error", `HighAsCG WS error: ${err.message}`);
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.init();
    }, 5000);
  }

  destroy() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
  }
}

export { HighAsCGWs };
