/**
 * @file streaming-presets.js
 * Preset buttons for the CONFIGURED stream/record outputs (WO-395).
 *
 * One Start (with active tally) + one Stop button per output that actually exists on the box
 * — no placeholder slots, same rule as the screen timers (WO-386). The streaming-channel
 * poller / WS handler re-runs the preset build whenever the output catalog changes.
 */

import { combineRgb } from "@companion-module/base";
import { getStreamOutputs, getRecordOutputs } from "../streaming-outputs.js";

const WHITE = combineRgb(255, 255, 255);
const RED = combineRgb(200, 0, 0);
const GREEN = combineRgb(0, 120, 40);
const SLATE = combineRgb(30, 40, 55);

function presetKey(prefix, id) {
  return `${prefix}_${String(id)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64)}`;
}

/**
 * @param {(sectionId: string, key: string, preset: object) => void} add
 * @param {import('../instance.js').HighAsCGInstance} instance
 */
export function addStreamingPresets(add, instance) {
  for (const out of getStreamOutputs(instance)) {
    const label = String(out.label || out.id).slice(0, 24);

    add("streaming", presetKey("stream_start", out.id), {
      type: "simple",
      name: `Stream ${label} · Start`,
      style: {
        text: `STREAM\\n${label}`,
        size: "14",
        color: WHITE,
        bgcolor: GREEN,
      },
      steps: [
        {
          down: [{ actionId: "rtmp_start", options: { output_id: out.id } }],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "streaming_active",
          options: { output_id: out.id },
          style: { bgcolor: RED, color: WHITE, text: `LIVE\\n${label}` },
        },
      ],
    });

    add("streaming", presetKey("stream_stop", out.id), {
      type: "simple",
      name: `Stream ${label} · Stop`,
      style: {
        text: `STOP\\nSTREAM`,
        size: "14",
        color: WHITE,
        bgcolor: SLATE,
      },
      steps: [
        {
          down: [{ actionId: "rtmp_stop", options: {} }],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "streaming_active",
          options: { output_id: out.id },
          style: { bgcolor: RED, color: WHITE },
        },
      ],
    });
  }

  for (const out of getRecordOutputs(instance)) {
    const label = String(out.label || out.id).slice(0, 24);

    add("streaming", presetKey("record_start", out.id), {
      type: "simple",
      name: `Record ${label} · Start`,
      style: {
        text: `REC\\n${label}`,
        size: "14",
        color: WHITE,
        bgcolor: GREEN,
      },
      steps: [
        {
          down: [{ actionId: "record_start", options: { output_id: out.id } }],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "recording_active",
          options: { output_id: out.id },
          style: { bgcolor: RED, color: WHITE, text: `REC ●\\n${label}` },
        },
      ],
    });

    add("streaming", presetKey("record_stop", out.id), {
      type: "simple",
      name: `Record ${label} · Stop`,
      style: {
        text: `STOP\\nREC`,
        size: "14",
        color: WHITE,
        bgcolor: SLATE,
      },
      steps: [
        {
          down: [{ actionId: "record_stop", options: { output_id: out.id } }],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "recording_active",
          options: { output_id: out.id },
          style: { bgcolor: RED, color: WHITE },
        },
      ],
    });
  }
}
