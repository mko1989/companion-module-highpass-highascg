/**
 * @file timeline-feedbacks.js
 * Timeline tally: playing / paused / stopped / looping, per timeline (or the active one).
 * Re-checked on every timeline state change (state-sync checkAllFeedbacks).
 */

import { combineRgb } from "@companion-module/base";
import { timelineOption, resolveTimelineId, playbackOf } from "./timelines.js";

/**
 * @param {import('./instance.js').HighAsCGInstance} instance
 * @param {string} rawId option value ("" = active)
 * @returns {"playing" | "paused" | "stopped"}
 */
export function timelineTransportState(instance, rawId) {
  const id = resolveTimelineId(instance, rawId);
  const pb = playbackOf(instance, id);
  if (pb.playing) return "playing";
  return pb.active && pb.position > 0 ? "paused" : "stopped";
}

export function getTimelineFeedbacks(instance) {
  return {
    timeline_state: {
      type: "boolean",
      name: "Timeline: transport state",
      description:
        "True while the timeline is in the chosen state (playing, paused or stopped).",
      defaultStyle: {
        bgcolor: combineRgb(0, 150, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        timelineOption(instance),
        {
          type: "dropdown",
          id: "state",
          label: "State",
          default: "playing",
          choices: [
            { id: "playing", label: "Playing" },
            { id: "paused", label: "Paused" },
            { id: "stopped", label: "Stopped" },
          ],
        },
      ],
      callback: (fb) =>
        timelineTransportState(instance, fb.options.id) === fb.options.state,
    },

    timeline_loop_on: {
      type: "boolean",
      name: "Timeline: loop is on",
      defaultStyle: {
        bgcolor: combineRgb(180, 120, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [timelineOption(instance)],
      callback: (fb) =>
        playbackOf(instance, resolveTimelineId(instance, fb.options.id)).loop,
    },
  };
}
