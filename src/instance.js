import { InstanceBase, InstanceStatus } from "@companion-module/base";
import getActions from "./actions/index.js";
import getFeedbacks from "./feedbacks.js";
import getVariables from "./variables.js";
import getPresets from "./presets.js";
import getConfigFields from "./config-fields.js";
import { HighAsCGTcp } from "./tcp.js";
import { HighAsCGBridge } from "./bridge/index.js";
import { ConnectionRouter } from "./connection-router.js";
import { getMainHost, normalizeConnectionConfig } from "./host-target.js";
import { isComposePreviewButtonsEnabled } from "./compose-preview-channels.js";
import {
  buildDeckSceneById,
  buildPresetLooks,
  mergeDeckNamesFromSnapshots,
  pruneDeckToSceneIds,
  refreshDeckLookNamesFromProject,
} from "./look-sync.js";
import { syncLookLabelVariables } from "./look-vars.js";
import { LookAirFrameCache } from "./look-air-frame.js";
import {
  extractProjectScenes,
  extractSceneDeck,
} from "./project-looks.js";

class HighAsCGInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    this.tcp = null;
    this.bridge = null;
    this.connectionRouter = null;
    /** @type {Map<string, object>} — full scene JSON from live deck sync (unsaved looks not in GET /api/project) */
    this._deckSceneById = new Map();
    /** @type {{ id: string, name: string }[]} — looks from HighAsCG project (for dynamic presets) */
    this._presetLooks = [];
    /** @type {Record<string, string>} — PTZ-style look slot map: slot -> look id */
    this._lookSlots = {};
    /** @type {string | null} — look id cued on preview (from HighAsCG scene.deck / WS sync) */
    this._previewLookId = null;
    /** @type {Record<string, { sceneId?: string }>} — program-channel keyed live scene snapshot */
    this._sceneLive = {};
    /** @type {object | null} — last channel map from /api/state (programChannels, previewChannels, …) */
    this._channelMap = null;
    /** @type {{ id: string, name: string, thumbnail: unknown }[]} — last GET /api/project look list */
    this._projectLooksCache = [];
    /** @type {object[]} — full scene objects from project (for take when not in deck snapshots) */
    this._projectScenesCache = [];
    /** @type {{ looks?: unknown[], sceneSnapshots?: unknown[], previewSceneId?: unknown } | null} */
    this._lastSceneDeck = null;
    /** @type {Promise<void> | null} */
    this._refreshPresetLooksPromise = null;
    /** @type {string} — when look ids / screen layout change (triggers preset catalog rebuild) */
    this._looksCatalogSig = "";
    this._lookAirFrames = new LookAirFrameCache(this);
  }

  /**
   * Signature of look ids + screen routing — preset catalog only needs refresh when this changes.
   *
   * @param {Array<{ id: string, mainScope?: string }>} looks
   */
  _looksCatalogSignature(looks) {
    const list = Array.isArray(looks) ? looks : [];
    const map = this._channelMap;
    const screenSig = JSON.stringify({
      n: Number(map?.screenCount) || (map?.programChannels?.length ?? 1),
      pgm: map?.programChannels || [],
      prv: map?.previewChannels || [],
    });
    const lookSig = list
      .map((l) => `${String(l.id).trim()}\0${l.mainScope ?? "all"}`)
      .sort()
      .join("\n");
    return `${screenSig}\n${lookSig}`;
  }

  async init(config, isFirstInit, secrets) {
    void isFirstInit;
    void secrets;
    this.config = normalizeConnectionConfig(config);
    this.updateStatus(InstanceStatus.Connecting);

    this.initConnectionRouter();
    this.initTcp();
    this.initBridge();
    this._syncConnectionVariables();

    this.updateActions();
    this.updateFeedbacks();
    this.updateVariables();
    this.updatePresets();
  }

  async destroy() {
    if (this.tcp) {
      this.tcp.destroy();
      this.tcp = null;
    }
    if (this.bridge) {
      this.bridge.destroy();
      this.bridge = null;
    }
    if (this.connectionRouter) {
      this.connectionRouter.stop();
      this.connectionRouter = null;
    }
    if (this._lookAirFrames) {
      this._lookAirFrames.reset();
    }
    this.log("debug", "HighAsCG Instance destroyed");
  }

  async configUpdated(config, secrets) {
    void secrets;
    const prev = normalizeConnectionConfig(this.config);
    this.config = normalizeConnectionConfig(config);

    const hostChanged = getMainHost(prev) !== getMainHost(this.config);
    const backupChanged =
      !!prev.hot_backup_enabled !== !!this.config.hot_backup_enabled ||
      String(prev.backup_host || "") !== String(this.config.backup_host || "");
    const portChanged =
      prev.port !== this.config.port ||
      prev.highascg_port !== this.config.highascg_port;
    const bridgeEnabledChanged =
      prev.highascg_enabled !== this.config.highascg_enabled;
    const previewButtonsChanged =
      isComposePreviewButtonsEnabled(prev) !==
      isComposePreviewButtonsEnabled(this.config);

    if (hostChanged || backupChanged) {
      this.connectionRouter?.resetTarget();
      this.initConnectionRouter();
    } else if (
      !!prev.hot_backup_enabled !== !!this.config.hot_backup_enabled
    ) {
      this.initConnectionRouter();
    }

    if (hostChanged || portChanged || backupChanged) {
      this.reconnectAll();
    } else if (bridgeEnabledChanged) {
      this.initBridge();
    }

    if (previewButtonsChanged) {
      this.updateVariables();
      this.updatePresets();
      if (this.bridge?.previewPoller) {
        this.bridge.previewPoller.stop();
        if (isComposePreviewButtonsEnabled(this.config)) {
          this.bridge.previewPoller.start();
          this.bridge.api
            ?.getState()
            .then((s) => this.handleBridgeState(s))
            .catch(() => {});
        }
      }
    }

    this._syncConnectionVariables();
  }

  initConnectionRouter() {
    if (this.connectionRouter) {
      this.connectionRouter.stop();
    }
    this.connectionRouter = new ConnectionRouter(this);
    this.connectionRouter.start();
  }

  /** Active box host (main or backup after failover). */
  getActiveHost() {
    return this.connectionRouter?.getActiveHost() ?? getMainHost(this.config);
  }

  /** `main` or `backup` — which configured box receives actions. */
  getConnectionTarget() {
    return this.connectionRouter?.getTarget() ?? "main";
  }

  reconnectAll() {
    this.initTcp();
    this.initBridge();
  }

  _syncConnectionVariables() {
    const router = this.connectionRouter;
    if (!router) return;
    this.setVariableValues({
      highascg_connection_target: router.getTarget(),
      highascg_active_host: router.getActiveHost(),
      highascg_main_host: getMainHost(this.config),
      highascg_backup_host:
        this.config.hot_backup_enabled && this.config.backup_host
          ? String(this.config.backup_host).trim()
          : "",
      highascg_accepts_control: "",
      highascg_control_plane_reason: "",
    });
  }

  getConfigFields() {
    return getConfigFields();
  }

  initTcp() {
    if (this.tcp) {
      this.tcp.destroy();
    }
    this.tcp = new HighAsCGTcp(this);
  }

  initBridge() {
    if (this.bridge) {
      this.bridge.destroy();
      this.bridge = null;
    }
    if (this.config.highascg_enabled) {
      this.bridge = new HighAsCGBridge(this);
    }
  }

  updateVariablesFromBridge(variables) {
    if (this.bridge && this.bridge.sync) {
      this.bridge.sync.updateVariables(variables);
    }
  }

  /** Full or partial HighAsCG snapshot (REST or WebSocket). */
  handleBridgeState(data) {
    if (this.bridge && this.bridge.sync) {
      this.bridge.sync.applyFullState(data);
    }
  }

  updateActions() {
    this.setActionDefinitions(getActions(this));
  }

  updateFeedbacks() {
    this.setFeedbackDefinitions(getFeedbacks(this));
  }

  updateVariables() {
    this.setVariableDefinitions(getVariables(this));
  }

  updatePresets() {
    const { structure, presets } = getPresets(this);
    this.setPresetDefinitions(structure, presets);
  }

  /**
   * Keep slot assignments stable while auto-filling empty slots by current look order.
   * @returns {void}
   */
  syncLookSlots() {
    const looks = Array.isArray(this._presetLooks) ? this._presetLooks : [];
    const used = new Set();
    const next = {};
    for (const [slot, lookId] of Object.entries(this._lookSlots || {})) {
      const id = String(lookId || "").trim();
      if (!id) continue;
      const exists = looks.some((l) => String(l.id) === id);
      if (!exists || used.has(id)) continue;
      next[String(slot)] = id;
      used.add(id);
    }
    let autoSlot = 1;
    for (const look of looks) {
      const id = String(look.id || "").trim();
      if (!id || used.has(id)) continue;
      while (next[String(autoSlot)]) autoSlot += 1;
      next[String(autoSlot)] = id;
      used.add(id);
    }
    this._lookSlots = next;
    this.checkFeedbacks("look_slot_on_pgm", "look_slot_on_prv");
  }

  getLookIdForSlot(slot) {
    const s = Math.max(1, parseInt(slot, 10) || 1);
    return String(this._lookSlots?.[String(s)] || "").trim();
  }

  setLookSlot(slot, lookId) {
    const s = Math.max(1, parseInt(slot, 10) || 1);
    const id = String(lookId || "").trim();
    if (!id) return false;
    this._lookSlots[String(s)] = id;
    this.checkFeedbacks("look_slot_on_pgm", "look_slot_on_prv");
    this.updatePresets();
    return true;
  }

  /**
   * @param {unknown} body
   * @returns {object[]}
   */
  _scenesFromProjectBody(body) {
    let scenes = extractProjectScenes(body);
    if (
      scenes.length === 0 &&
      body &&
      typeof body === "object" &&
      /** @type {Record<string, unknown>} */ (body).project
    ) {
      scenes = extractProjectScenes(
        /** @type {Record<string, unknown>} */ (body).project,
      );
    }
    return scenes;
  }

  /**
   * @param {object[]} scenes
   * @returns {void}
   */
  _setProjectScenesCache(scenes) {
    const list = Array.isArray(scenes) ? scenes : [];
    this._projectScenesCache = list;
    this._projectLooksCache = list.map((s) => ({
      id: String(s.id),
      name: String(s.name || "Look").slice(0, 120),
      thumbnail: s.thumbnail || s.thumb || s.image || s.previewImage || null,
    }));
  }

  /**
   * Reload look list + scene payloads from saved project (disk/Caspar merge on server).
   * @returns {Promise<void>}
   */
  async reloadProjectLooksCache() {
    if (!this.bridge?.api) {
      this._projectLooksCache = [];
      this._projectScenesCache = [];
      return;
    }
    try {
      let scenes = [];
      try {
        const body = await this.bridge.api.getProject();
        scenes = this._scenesFromProjectBody(body);
      } catch (e) {
        this.log("debug", `reloadProjectLooksCache GET /api/project: ${e.message || e}`);
      }
      this._setProjectScenesCache(scenes);
      this.log(
        "debug",
        `Project looks cache: ${this._projectLooksCache.length} scene(s)`,
      );
    } catch (e) {
      this.log("debug", `reloadProjectLooksCache: ${e.message || e}`);
      this._projectLooksCache = [];
      this._projectScenesCache = [];
    }
  }

  /**
   * Full project broadcast from HighAsCG (`project_sync` after autosave / load).
   * @param {unknown} project
   */
  applyProjectSync(project) {
    if (!project || typeof project !== "object") return;
    const o = /** @type {Record<string, unknown>} */ (project);
    if (o.error || o.version == null) return;
    const scenes = this._scenesFromProjectBody(project);
    if (scenes.length === 0) return;
    this._setProjectScenesCache(scenes);
    const validIds = new Set(
      scenes.map((s) => String(s.id).trim()).filter(Boolean),
    );
    if (this._lastSceneDeck) {
      this._lastSceneDeck = pruneDeckToSceneIds(this._lastSceneDeck, validIds);
    }
    this.log(
      "debug",
      `Project sync: ${this._projectLooksCache.length} scene(s) in cache`,
    );
    if (this._lastSceneDeck) {
      const deck = refreshDeckLookNamesFromProject(
        mergeDeckNamesFromSnapshots(this._lastSceneDeck),
        this._projectLooksCache,
      );
      this._applyMergedLooksFromDeck(deck);
    } else if (this._projectLooksCache.length > 0) {
      this._applyMergedLooksFromDeck({
        looks: this._projectLooksCache,
        previewSceneId: null,
        sceneSnapshots: this._projectScenesCache,
      });
    }
  }

  /**
   * Apply merged look list to presets/actions (after deck and/or project data changed).
   * @param {{ looks?: unknown[], previewSceneId?: unknown } | null | undefined} deck
   * @param {{ skipUiRefresh?: boolean }} [opts]
   */
  _applyMergedLooksFromDeck(deck, opts) {
    if (deck && typeof deck === "object") {
      this._lastSceneDeck = deck;
    }
    this._presetLooks = buildPresetLooks(this._projectLooksCache, deck);
    const validLookIds = new Set(this._presetLooks.map((l) => l.id));
    this._deckSceneById = buildDeckSceneById(
      deck,
      this._projectScenesCache,
      validLookIds,
    );
    const p = deck?.previewSceneId;
    const previewId = p != null && String(p).trim() ? String(p).trim() : null;
    const prevPreviewLookId = this._previewLookId;
    this._previewLookId =
      previewId && validLookIds.has(previewId) ? previewId : null;
    this.syncLookSlots();
    this.updateVariables();
    syncLookLabelVariables(this, this._presetLooks);

    const catalogSig = this._looksCatalogSignature(this._presetLooks);
    const catalogChanged = catalogSig !== this._looksCatalogSig;
    this._looksCatalogSig = catalogSig;

    if (!opts?.skipUiRefresh) {
      const deckLooks = Array.isArray(deck?.looks) ? deck.looks.length : 0;
      this.log(
        "debug",
        `Look list updated: ${this._presetLooks.length} (deck looks ${deckLooks}, project ${this._projectLooksCache.length})`,
      );
      if (catalogChanged) {
        this.updatePresets();
        this.updateActions();
        this.subscribeActions();
      } else if (this._previewLookId !== prevPreviewLookId) {
        this.checkFeedbacks("look_on_prv", "look_on_prv_for_screen");
      }
    }
  }

  /**
   * Live look deck from HighAsCG `scene.deck` or `scene_deck_sync` (WebSocket / GET /api/state).
   * Merged with full project look list so Companion is not capped to a partial deck snapshot.
   * @param {{ looks?: unknown, previewSceneId?: unknown, sceneSnapshots?: unknown } | null | undefined} deck
   */
  applySceneDeck(deck) {
    if (!deck || typeof deck !== "object") return;
    const merged = mergeDeckNamesFromSnapshots(deck);
    this._applyMergedLooksFromDeck(merged);
  }

  /**
   * Load project looks, optional `scene.deck` from state, then refresh presets/actions.
   * @returns {Promise<void>}
   */
  async refreshPresetLooks() {
    if (this._refreshPresetLooksPromise) {
      return this._refreshPresetLooksPromise;
    }
    this._refreshPresetLooksPromise = this._refreshPresetLooksImpl().finally(() => {
      this._refreshPresetLooksPromise = null;
    });
    return this._refreshPresetLooksPromise;
  }

  async _refreshPresetLooksImpl() {
    if (!this.config.highascg_enabled || !this.bridge?.api) {
      this._presetLooks = [];
      this._previewLookId = null;
      this._deckSceneById = new Map();
      this._projectLooksCache = [];
      this._projectScenesCache = [];
      this.updatePresets();
      this.updateActions();
      return;
    }

    await this.reloadProjectLooksCache();

    let deck = this._lastSceneDeck;
    if (!deck) {
      try {
        const st = await this.bridge.api.getState();
        deck = extractSceneDeck(st);
      } catch (e) {
        this.log("debug", `refreshPresetLooks getState: ${e.message || e}`);
      }
    }

    if (deck) {
      this._applyMergedLooksFromDeck(deck);
    } else if (this._projectLooksCache.length > 0) {
      this._applyMergedLooksFromDeck({
        looks: this._projectLooksCache,
        previewSceneId: null,
        sceneSnapshots: this._projectScenesCache,
      });
    } else {
      this._presetLooks = [];
      this._previewLookId = null;
      this._deckSceneById = new Map();
      this.syncLookSlots();
      this.updatePresets();
      this.updateActions();
      this.subscribeActions();
    }
  }
}

export { HighAsCGInstance };
export default HighAsCGInstance;
