import { getBackupHost, getBridgePort, getMainHost } from "./host-target.js";

const HEALTH_INTERVAL_MS = 5000;
const MAIN_FAIL_THRESHOLD = 2;
const PROBE_TIMEOUT_MS = 3000;

/**
 * @typedef {object} ControlStatus
 * @property {boolean} [acceptsCompanionControl]
 * @property {'self'|'peer'|'none'} [suggestedCompanionTarget]
 * @property {string} [controlPlaneReason]
 */

class ConnectionRouter {
  /**
   * @param {import('./instance.js').HighAsCGInstance} instance
   */
  constructor(instance) {
    this.instance = instance;
    /** @type {'main' | 'backup'} */
    this.target = "main";
    this._mainFailCount = 0;
    /** @type {ReturnType<typeof setInterval> | null} */
    this._healthTimer = null;
    this._healthInFlight = false;
    /** @type {ControlStatus | null} */
    this._lastControlStatus = null;
  }

  start() {
    this.stop();
    if (!this.instance.config.hot_backup_enabled) return;
    this._healthTimer = setInterval(() => {
      void this._healthCheck();
    }, HEALTH_INTERVAL_MS);
    if (this._healthTimer.unref) this._healthTimer.unref();
  }

  stop() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
    this._mainFailCount = 0;
    this._healthInFlight = false;
    this._lastControlStatus = null;
  }

  resetTarget() {
    this.target = "main";
    this._mainFailCount = 0;
    this._lastControlStatus = null;
    this._updateConnectionVariables();
  }

  /** @returns {'main' | 'backup'} */
  getTarget() {
    return this.target;
  }

  /** @returns {string} */
  getActiveHost() {
    const cfg = this.instance.config;
    if (this.target === "backup" && cfg.hot_backup_enabled) {
      const backup = getBackupHost(cfg);
      if (backup) return backup;
    }
    return getMainHost(cfg);
  }

  _updateConnectionVariables() {
    const host = this.getActiveHost();
    const st = this._lastControlStatus;
    this.instance.setVariableValues({
      highascg_connection_target: this.target,
      highascg_active_host: host,
      highascg_main_host: getMainHost(this.instance.config),
      highascg_backup_host: getBackupHost(this.instance.config) || "",
      highascg_accepts_control: st?.acceptsCompanionControl ? "true" : "false",
      highascg_control_plane_reason: st?.controlPlaneReason || "",
    });
    this.instance.checkFeedbacks(
      "hot_backup_on_backup",
      "caspar_connected",
      "highascg_connected",
    );
  }

  /**
   * @param {string} host
   * @returns {Promise<ControlStatus | null>}
   */
  async _fetchControlStatus(host) {
    const cfg = this.instance.config;
    const port = getBridgePort(cfg);

    if (cfg.highascg_enabled) {
      try {
        const res = await fetch(
          `http://${host}:${port}/api/companion/control-status`,
          { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) },
        );
        if (res.ok) {
          const body = await res.json();
          if (body && typeof body === "object") return body;
        }
      } catch {
        /* fall through to legacy probe */
      }
      try {
        const res = await fetch(`http://${host}:${port}/api/state`, {
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        if (res.ok) {
          return {
            acceptsCompanionControl: true,
            suggestedCompanionTarget: "self",
            controlPlaneReason: "legacy_reachable",
          };
        }
      } catch {
        return null;
      }
    }

    if (this.target === "main" && host === getMainHost(cfg)) {
      return this.instance.tcp?.connected
        ? {
            acceptsCompanionControl: true,
            suggestedCompanionTarget: "self",
            controlPlaneReason: "legacy_tcp",
          }
        : null;
    }

    try {
      const res = await fetch(`http://${host}:${port}/api/state`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (res.ok) {
        return {
          acceptsCompanionControl: true,
          suggestedCompanionTarget: "self",
          controlPlaneReason: "legacy_reachable",
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * @param {ControlStatus | null} status
   * @returns {boolean}
   */
  _hostAcceptsControl(status) {
    if (!status) return false;
    if (status.acceptsCompanionControl === true) return true;
    return status.suggestedCompanionTarget === "self";
  }

  /**
   * @param {ControlStatus | null} status
   * @returns {boolean}
   */
  _hostDefersToPeer(status) {
    return (
      !!status &&
      status.acceptsCompanionControl === false &&
      status.suggestedCompanionTarget === "peer"
    );
  }

  async _healthCheck() {
    if (!this.instance.config.hot_backup_enabled) return;
    const backup = getBackupHost(this.instance.config);
    if (!backup) return;
    if (this._healthInFlight) return;
    this._healthInFlight = true;
    try {
      const main = getMainHost(this.instance.config);
      const mainStatus = await this._fetchControlStatus(main);
      const mainOk = this._hostAcceptsControl(mainStatus);
      const mainDefers = this._hostDefersToPeer(mainStatus);

      if (this.target === "main") {
        this._lastControlStatus = mainStatus;
        if (!mainOk || mainDefers) {
          this._mainFailCount += 1;
          if (this._mainFailCount >= MAIN_FAIL_THRESHOLD) {
            const backupStatus = await this._fetchControlStatus(backup);
            if (this._hostAcceptsControl(backupStatus)) {
              this._lastControlStatus = backupStatus;
              this._switchToBackup(backup);
            }
          }
        } else {
          this._mainFailCount = 0;
        }
        this._updateConnectionVariables();
        return;
      }

      if (mainOk && !mainDefers) {
        this._lastControlStatus = mainStatus;
        this._switchToMain(main);
      } else {
        const backupStatus = await this._fetchControlStatus(backup);
        this._lastControlStatus = backupStatus || mainStatus;
      }
      this._updateConnectionVariables();
    } finally {
      this._healthInFlight = false;
    }
  }

  /**
   * @param {string} backupHost
   */
  _switchToBackup(backupHost) {
    if (this.target === "backup") return;
    this.instance.log(
      "warn",
      `Hot backup: main not accepting control — failing over to backup (${backupHost})`,
    );
    this.target = "backup";
    this._mainFailCount = 0;
    this.instance.reconnectAll();
    this._updateConnectionVariables();
  }

  /**
   * @param {string} mainHost
   */
  _switchToMain(mainHost) {
    if (this.target === "main") return;
    this.instance.log(
      "info",
      `Hot backup: main restored (${mainHost}) — switching back to leader`,
    );
    this.target = "main";
    this._mainFailCount = 0;
    this.instance.reconnectAll();
    this._updateConnectionVariables();
  }

  /** Called when the active bridge socket drops — nudge health check. */
  notifyBridgeDisconnected() {
    if (!this.instance.config.hot_backup_enabled) return;
    if (this.target !== "main") return;
    this._mainFailCount += 1;
    if (this._mainFailCount >= MAIN_FAIL_THRESHOLD) {
      void this._healthCheck();
    }
  }
}

export { ConnectionRouter };
