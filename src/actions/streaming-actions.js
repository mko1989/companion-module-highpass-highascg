/**
 * @file streaming-actions.js
 * RTMP streaming and recording actions.
 */

export default function (instance) {
  return {
    rtmp_start: {
      name: "RTMP: Start streaming",
      options: [
        {
          type: "textinput",
          id: "rtmp_server_url",
          label: "RTMP server URL",
          default: "rtmp://example.com/live",
        },
        {
          type: "textinput",
          id: "stream_key",
          label: "Stream key",
          default: "streamkey123",
        },
        {
          type: "dropdown",
          id: "quality",
          label: "Quality preset",
          default: "medium",
          choices: [
            { id: "low", label: "Low (720p)" },
            { id: "medium", label: "Medium (1080p)" },
            { id: "high", label: "High (1080p HQ)" },
          ],
        },
        {
          type: "textinput",
          id: "output_id",
          label: "Output config ID (optional)",
          default: "",
        },
        {
          type: "textinput",
          id: "video_codec",
          label: "Video codec (optional, e.g. h264)",
          default: "",
        },
        {
          type: "number",
          id: "video_bitrate_kbps",
          label: "Video bitrate (kbps, optional)",
          default: 0,
          min: 0,
          max: 100000,
        },
        {
          type: "textinput",
          id: "audio_codec",
          label: "Audio codec (optional, e.g. aac)",
          default: "",
        },
        {
          type: "number",
          id: "audio_bitrate_kbps",
          label: "Audio bitrate (kbps, optional)",
          default: 0,
          min: 0,
          max: 320,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const opts = {
          action: "start",
          rtmpServerUrl: String(action.options.rtmp_server_url || "").trim(),
          streamKey: String(action.options.stream_key || "").trim(),
          quality: String(action.options.quality || "medium").toLowerCase(),
        };
        const outputId = String(action.options.output_id || "").trim();
        if (outputId) opts.outputId = outputId;
        const videoCodec = String(action.options.video_codec || "").trim();
        if (videoCodec) opts.videoCodec = videoCodec;
        const videoBitrateKbps = Math.max(0, parseInt(action.options.video_bitrate_kbps, 10) || 0);
        if (videoBitrateKbps > 0) opts.videoBitrateKbps = videoBitrateKbps;
        const audioCodec = String(action.options.audio_codec || "").trim();
        if (audioCodec) opts.audioCodec = audioCodec;
        const audioBitrateKbps = Math.max(0, parseInt(action.options.audio_bitrate_kbps, 10) || 0);
        if (audioBitrateKbps > 0) opts.audioBitrateKbps = audioBitrateKbps;
        try {
          await instance.bridge.api.rtmpStreaming(opts);
        } catch (e) {
          instance.log("error", `RTMP start: ${e.message || e}`);
        }
      },
    },

    rtmp_stop: {
      name: "RTMP: Stop streaming",
      options: [],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        try {
          await instance.bridge.api.rtmpStreaming({ action: "stop" });
        } catch (e) {
          instance.log("error", `RTMP stop: ${e.message || e}`);
        }
      },
    },

    record_start: {
      name: "Record: Start recording",
      options: [
        {
          type: "textinput",
          id: "output_id",
          label: "Output config ID (optional)",
          default: "",
        },
        {
          type: "number",
          id: "crf",
          label: "Quality (CRF, 18-51, default 26)",
          default: 26,
          min: 18,
          max: 51,
        },
        {
          type: "textinput",
          id: "video_codec",
          label: "Video codec (optional, e.g. h264)",
          default: "",
        },
        {
          type: "number",
          id: "video_bitrate_kbps",
          label: "Video bitrate (kbps, optional)",
          default: 0,
          min: 0,
          max: 100000,
        },
        {
          type: "textinput",
          id: "audio_codec",
          label: "Audio codec (optional, e.g. aac)",
          default: "",
        },
        {
          type: "number",
          id: "audio_bitrate_kbps",
          label: "Audio bitrate (kbps, optional)",
          default: 0,
          min: 0,
          max: 320,
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const opts = {
          action: "start",
        };
        const outputId = String(action.options.output_id || "").trim();
        if (outputId) opts.outputId = outputId;
        const crf = Math.max(18, Math.min(51, parseInt(action.options.crf, 10) || 26));
        opts.crf = crf;
        const videoCodec = String(action.options.video_codec || "").trim();
        if (videoCodec) opts.videoCodec = videoCodec;
        const videoBitrateKbps = Math.max(0, parseInt(action.options.video_bitrate_kbps, 10) || 0);
        if (videoBitrateKbps > 0) opts.videoBitrateKbps = videoBitrateKbps;
        const audioCodec = String(action.options.audio_codec || "").trim();
        if (audioCodec) opts.audioCodec = audioCodec;
        const audioBitrateKbps = Math.max(0, parseInt(action.options.audio_bitrate_kbps, 10) || 0);
        if (audioBitrateKbps > 0) opts.audioBitrateKbps = audioBitrateKbps;
        try {
          await instance.bridge.api.recordStreaming(opts);
        } catch (e) {
          instance.log("error", `Record start: ${e.message || e}`);
        }
      },
    },

    record_stop: {
      name: "Record: Stop recording",
      options: [
        {
          type: "textinput",
          id: "output_id",
          label: "Output config ID (optional, stops all if empty)",
          default: "",
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        const opts = {
          action: "stop",
        };
        const outputId = String(action.options.output_id || "").trim();
        if (outputId) opts.outputId = outputId;
        try {
          await instance.bridge.api.recordStreaming(opts);
        } catch (e) {
          instance.log("error", `Record stop: ${e.message || e}`);
        }
      },
    },
  };
}
