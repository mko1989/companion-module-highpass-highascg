import { combineRgb } from "@companion-module/base";
import {
  dataUriToRawBase64,
  resolveLookAirState,
  resolveAudioOnlyLookAirState,
} from "./look-air-state.js";
import {
  streamOutputChoices,
  recordOutputChoices,
} from "./streaming-outputs.js";

/**
 * @file feedbacks.js
 * Feedback definitions for tally and status.
 */

export default function (instance) {
  return {
    look_on_pgm: {
      type: "boolean",
      name: "Look is on program (PGM)",
      description:
        "True when this look id matches the live scene on the program channel for the given screen index (from HighAsCG scene.live). On layered buttons, add style overrides on your image layer: opacity 100 and base64Image = $(highpass-highascg:highascg_compose_preview_ch{N}_image) for the screen PGM channel.",
      defaultStyle: {
        bgcolor: combineRgb(200, 0, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "textinput",
          id: "look_id",
          label: "Look id",
          default: "",
        },
        {
          type: "number",
          id: "screen_index",
          label: "Screen index",
          default: 0,
          min: 0,
          max: 7,
        },
      ],
      callback: (feedback) => {
        const lookId = String(feedback.options.look_id ?? "").trim();
        if (!lookId) return false;
        const screenIdx = Math.max(
          0,
          parseInt(feedback.options.screen_index, 10) || 0,
        );
        const ch = instance._channelMap?.programChannels?.[screenIdx];
        if (ch == null) return false;
        const entry = instance._sceneLive?.[String(ch)];
        const sid = entry?.sceneId != null ? String(entry.sceneId).trim() : "";
        return sid === lookId;
      },
    },
    look_on_prv: {
      type: "boolean",
      name: "Look is on preview (PRV)",
      description:
        "True when this look is cued on the preview bus (synced from the HighAsCG web UI over scene.deck).",
      defaultStyle: {
        bgcolor: combineRgb(0, 180, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "textinput",
          id: "look_id",
          label: "Look id",
          default: "",
        },
      ],
      callback: (feedback) => {
        const lookId = String(feedback.options.look_id ?? "").trim();
        if (!lookId) return false;
        const prv =
          instance._previewLookId != null
            ? String(instance._previewLookId).trim()
            : "";
        return prv === lookId;
      },
    },
    look_on_prv_for_screen: {
      type: "boolean",
      name: "Look is on preview for screen (PRV bus)",
      description:
        "True when this look is live on the preview Caspar channel for the given screen index (from scene.live). Hidden when the same look is on PGM for that screen. On layered buttons, add style overrides on your image layer: opacity 100 and base64Image = $(highpass-highascg:highascg_compose_preview_ch{N}_image) for the screen PRV channel.",
      defaultStyle: {
        bgcolor: combineRgb(0, 180, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "textinput",
          id: "look_id",
          label: "Look id",
          default: "",
        },
        {
          type: "number",
          id: "screen_index",
          label: "Screen index",
          default: 0,
          min: 0,
          max: 7,
        },
      ],
      callback: (feedback) => {
        const lookId = String(feedback.options.look_id ?? "").trim();
        if (!lookId) return false;
        const screenIdx = Math.max(
          0,
          parseInt(feedback.options.screen_index, 10) || 0,
        );
        const prvCh = instance._channelMap?.previewChannels?.[screenIdx];
        if (prvCh == null || Number(prvCh) <= 0) return false;
        const pgmCh = instance._channelMap?.programChannels?.[screenIdx];
        if (pgmCh != null) {
          const pgmEntry = instance._sceneLive?.[String(pgmCh)];
          const pgmSid =
            pgmEntry?.sceneId != null ? String(pgmEntry.sceneId).trim() : "";
          if (pgmSid === lookId) return false;
        }
        const entry = instance._sceneLive?.[String(prvCh)];
        const sid = entry?.sceneId != null ? String(entry.sceneId).trim() : "";
        return sid === lookId;
      },
    },
    // WO-572 (HighAsCG) — audio-only looks: additive per-screen audio, tracked in a SEPARATE live
    // map (scene.liveAudioOnly) since a screen can have one live video look and one live
    // audio-only look at once. Colors match the HighAsCG web UI's deck ring for the same state
    // (cyan live / violet preview) — deliberately NOT the video look's red/green, so an operator
    // never reads "this audio-only look is live" as "this replaced the screen".
    look_audio_only_is_live: {
      type: "boolean",
      name: "Audio-only look is playing (PGM)",
      description:
        "True when this audio-only look id matches the live entry on the program channel for the given screen index (from HighAsCG scene.liveAudioOnly). Independent of any video look on the same screen.",
      defaultStyle: {
        bgcolor: combineRgb(34, 211, 238),
        color: combineRgb(0, 0, 0),
      },
      options: [
        {
          type: "textinput",
          id: "look_id",
          label: "Look id",
          default: "",
        },
        {
          type: "number",
          id: "screen_index",
          label: "Screen index",
          default: 0,
          min: 0,
          max: 7,
        },
      ],
      callback: (feedback) => {
        const lookId = String(feedback.options.look_id ?? "").trim();
        if (!lookId) return false;
        const screenIdx = Math.max(
          0,
          parseInt(feedback.options.screen_index, 10) || 0,
        );
        return resolveAudioOnlyLookAirState(instance, lookId, screenIdx).onPgm;
      },
    },
    look_audio_only_is_preview: {
      type: "boolean",
      name: "Audio-only look is staged (PRV)",
      description:
        "True when this audio-only look is staged on the preview Caspar channel for the given screen index (from scene.liveAudioOnly). Hidden when the same audio-only look is already playing on PGM for that screen.",
      defaultStyle: {
        bgcolor: combineRgb(167, 139, 250),
        color: combineRgb(0, 0, 0),
      },
      options: [
        {
          type: "textinput",
          id: "look_id",
          label: "Look id",
          default: "",
        },
        {
          type: "number",
          id: "screen_index",
          label: "Screen index",
          default: 0,
          min: 0,
          max: 7,
        },
      ],
      callback: (feedback) => {
        const lookId = String(feedback.options.look_id ?? "").trim();
        if (!lookId) return false;
        const screenIdx = Math.max(
          0,
          parseInt(feedback.options.screen_index, 10) || 0,
        );
        return resolveAudioOnlyLookAirState(instance, lookId, screenIdx).onPrv;
      },
    },
    look_slot_on_pgm: {
      type: "boolean",
      name: "Look slot is on program (PGM)",
      description: "True when the look assigned to this slot is on PGM.",
      defaultStyle: {
        bgcolor: combineRgb(200, 0, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "number",
          id: "slot",
          label: "Slot",
          default: 1,
          min: 1,
          max: 99,
        },
        {
          type: "number",
          id: "screen_index",
          label: "Screen index",
          default: 0,
          min: 0,
          max: 7,
        },
      ],
      callback: (feedback) => {
        const slot = Math.max(1, parseInt(feedback.options.slot, 10) || 1);
        const lookId = instance.getLookIdForSlot(slot);
        if (!lookId) return false;
        const screenIdx = Math.max(
          0,
          parseInt(feedback.options.screen_index, 10) || 0,
        );
        const ch = instance._channelMap?.programChannels?.[screenIdx];
        if (ch == null) return false;
        const entry = instance._sceneLive?.[String(ch)];
        const sid = entry?.sceneId != null ? String(entry.sceneId).trim() : "";
        return sid === lookId;
      },
    },
    look_slot_on_prv: {
      type: "boolean",
      name: "Look slot is on preview (PRV)",
      description: "True when the look assigned to this slot is on PRV.",
      defaultStyle: {
        bgcolor: combineRgb(0, 180, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "number",
          id: "slot",
          label: "Slot",
          default: 1,
          min: 1,
          max: 99,
        },
      ],
      callback: (feedback) => {
        const slot = Math.max(1, parseInt(feedback.options.slot, 10) || 1);
        const lookId = instance.getLookIdForSlot(slot);
        if (!lookId) return false;
        const prv =
          instance._previewLookId != null
            ? String(instance._previewLookId).trim()
            : "";
        return prv === lookId;
      },
    },
    hot_backup_on_backup: {
      type: "boolean",
      name: "Hot backup: on backup box",
      description:
        "True when main is unreachable and Companion is sending actions to the backup host.",
      defaultStyle: {
        bgcolor: combineRgb(220, 120, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [],
      callback: () => {
        return (
          !!instance.config.hot_backup_enabled &&
          instance.getConnectionTarget() === "backup"
        );
      },
    },
    caspar_connected: {
      type: "boolean",
      name: "Caspar Connected (via HighAsCG)",
      description:
        "True when the HighAsCG app reports its Caspar server connected",
      defaultStyle: {
        bgcolor: combineRgb(0, 255, 0),
        color: combineRgb(0, 0, 0),
      },
      options: [],
      callback: () => {
        // WO-394: no direct AMCP socket anymore — the app reports this over the bridge
        // (state.caspar.connected, captured by state-sync).
        return !!instance._casparStatus?.connected;
      },
    },
    highascg_connected: {
      type: "boolean",
      name: "HighAsCG App Connected",
      description: "Checks if the bridge to the standalone app is connected",
      defaultStyle: {
        bgcolor: combineRgb(0, 0, 255),
        color: combineRgb(255, 255, 255),
      },
      options: [],
      callback: () => {
        return instance.bridge?.ws?.ws?.readyState === 1;
      },
    },

    look_compose_preview_image: {
      type: "advanced",
      name: "Look on air — compose preview image",
      description:
        "Shows the PGM or PRV compose preview for this look on a simple button (png64). For layered buttons, prefer look_on_pgm / look_on_prv_for_screen with image-layer style overrides instead.",
      affectedProperties: ["png64"],
      options: [
        {
          type: "textinput",
          id: "look_id",
          label: "Look id",
          default: "",
        },
        {
          type: "number",
          id: "screen_index",
          label: "Screen index",
          default: 0,
          min: 0,
          max: 7,
        },
      ],
      callback: (feedback) => {
        const lookId = String(feedback.options.look_id ?? "").trim();
        if (!lookId) return {};
        const screenIdx = Math.max(
          0,
          parseInt(feedback.options.screen_index, 10) || 0,
        );
        const state = resolveLookAirState(instance, lookId, screenIdx);
        if (!state.previewVariableId) return {};
        const uri = instance.getVariableValue(state.previewVariableId);
        if (!uri) return {};
        const png64 = dataUriToRawBase64(uri);
        if (!png64) return {};
        return { png64 };
      },
    },

    ui_selection_layer_ready: {
      type: "boolean",
      name: "UI selection: layer can be routed",
      description:
        "True when ui_selection_context is scene_layer and preview channel + Caspar layer vars resolve (mixer paint actions).",
      defaultStyle: {
        bgcolor: combineRgb(0, 140, 60),
        color: combineRgb(255, 255, 255),
      },
      options: [],
      callback: () => {
        const sync = instance.bridge?.sync;
        if (!sync) return false;
        const ctx = String(
          sync.getServerVariable("ui_selection_context") ?? "",
        ).trim();
        if (ctx !== "scene_layer") return false;
        const ch = Number(
          sync.getServerVariable("ui_selection_look_preview_channel"),
        );
        const layer = Number(
          sync.getServerVariable("ui_selection_look_caspar_layer") ||
            sync.getServerVariable("ui_selection_look_layer_number"),
        );
        return Number.isFinite(ch) && Number.isFinite(layer);
      },
    },

    ui_selection_context_is: {
      type: "boolean",
      name: "UI selection: context is …",
      description:
        "Compare ui_selection_context to none / scene_layer / timeline_clip / multiview.",
      defaultStyle: {
        bgcolor: combineRgb(70, 70, 120),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "dropdown",
          id: "context",
          label: "Context",
          default: "scene_layer",
          choices: [
            { id: "none", label: "none" },
            { id: "scene_layer", label: "scene_layer" },
            { id: "timeline_clip", label: "timeline_clip" },
            { id: "multiview", label: "multiview" },
          ],
        },
      ],
      callback: (feedback) => {
        const sync = instance.bridge?.sync;
        if (!sync) return false;
        const ctx = String(
          sync.getServerVariable("ui_selection_context") ?? "",
        ).trim();
        return ctx === String(feedback.options.context || "").trim();
      },
    },

    streaming_active: {
      type: "boolean",
      name: "Stream output is active",
      description:
        "True when streaming is running (optionally a specific configured output)",
      defaultStyle: {
        bgcolor: combineRgb(200, 0, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "dropdown",
          id: "output_id",
          label: "Output",
          default: "",
          choices: [
            { id: "", label: "Any" },
            ...streamOutputChoices(instance).filter((c) => c.id),
          ],
        },
      ],
      callback: (feedback) => {
        // WO-395: read the raw status (fed by WS broadcast + poller); variable fallback
        // keeps pre-395 buttons alive until the first status arrives.
        const rtmp = instance._streamingChannelStatus?.rtmp;
        const wanted = String(feedback.options?.output_id || "").trim();
        if (rtmp) {
          if (!rtmp.active) return false;
          return !wanted || String(rtmp.outputId || "") === wanted;
        }
        return (
          String(
            instance.getVariableValue("highascg_rtmp_state") ?? "",
          ).trim() === "active"
        );
      },
    },

    recording_active: {
      type: "boolean",
      name: "Record output is active",
      description:
        "True when recording is running (optionally a specific configured output)",
      defaultStyle: {
        bgcolor: combineRgb(200, 0, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "dropdown",
          id: "output_id",
          label: "Output",
          default: "",
          choices: [
            { id: "", label: "Any" },
            ...recordOutputChoices(instance).filter((c) => c.id),
          ],
        },
      ],
      callback: (feedback) => {
        const record = instance._streamingChannelStatus?.record;
        const wanted = String(feedback.options?.output_id || "").trim();
        if (record) {
          if (!record.active) return false;
          if (!wanted) return true;
          const ids = Array.isArray(record.activeOutputs)
            ? record.activeOutputs.map(String)
            : [];
          return ids.includes(wanted);
        }
        return (
          String(
            instance.getVariableValue("highascg_record_state") ?? "",
          ).trim() === "recording"
        );
      },
    },
  };
}
