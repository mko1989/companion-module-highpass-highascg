import { HighAsCGApi } from "./api-client.js";
import { HighAsCGWs } from "./ws-client.js";
import { HighAsCGStateSync } from "./state-sync.js";
import { ComposePreviewPoller } from "./compose-preview-poller.js";
import { StreamingChannelPoller } from "./streaming-channel-poller.js";
import { ScreenTimerPoller } from "./screen-timer-poller.js";
import { sendCompanionHello } from "./companion-hello.js";

class HighAsCGBridge {
  constructor(instance) {
    this.instance = instance;
    this.api = new HighAsCGApi(instance);
    this.sync = new HighAsCGStateSync(instance);
    this.previewPoller = new ComposePreviewPoller(instance);
    this.streamingChannelPoller = new StreamingChannelPoller(instance);
    this.screenTimerPoller = new ScreenTimerPoller(instance);
    this.ws = new HighAsCGWs(instance);
    this.previewPoller.start();
    this.streamingChannelPoller.start();
    this.screenTimerPoller.start();
    this.api
      .getState()
      .then((s) => {
        instance.handleBridgeState(s);
        sendCompanionHello(instance);
        void instance.refreshPresetLooks();
      })
      .catch(() => {});
  }

  destroy() {
    if (this.previewPoller) {
      this.previewPoller.stop();
      this.previewPoller = null;
    }
    if (this.streamingChannelPoller) {
      this.streamingChannelPoller.stop();
      this.streamingChannelPoller = null;
    }
    if (this.screenTimerPoller) {
      this.screenTimerPoller.stop();
      this.screenTimerPoller = null;
    }
    if (this.ws) {
      this.ws.destroy();
      this.ws = null;
    }
    this.sync = null;
    this.api = null;
  }
}

export { HighAsCGBridge };
