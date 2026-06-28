import { HighAsCGApi } from "./api-client.js";
import { HighAsCGWs } from "./ws-client.js";
import { HighAsCGStateSync } from "./state-sync.js";
import { ComposePreviewPoller } from "./compose-preview-poller.js";

class HighAsCGBridge {
  constructor(instance) {
    this.instance = instance;
    this.api = new HighAsCGApi(instance);
    this.sync = new HighAsCGStateSync(instance);
    this.previewPoller = new ComposePreviewPoller(instance);
    this.ws = new HighAsCGWs(instance);
    this.previewPoller.start();
    this.api
      .getState()
      .then((s) => {
        instance.handleBridgeState(s);
        void instance.refreshPresetLooks();
      })
      .catch(() => {});
  }

  destroy() {
    if (this.previewPoller) {
      this.previewPoller.stop();
      this.previewPoller = null;
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
