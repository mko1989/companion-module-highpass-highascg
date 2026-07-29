/**
 * @file highascg-actions.js
 * Aggregates HighAsCG bridge action modules.
 */

import getLookActions from "./look-actions.js";
import getSelectedLayerActions from "./selected-layer-actions.js";
import getTimelineActions from "./timeline-actions.js";
import getMixerLayerActions from "./mixer-layer-actions.js";
import getPipOverlayActions from "./pip-overlay-actions.js";
import getMiscActions from "./misc-actions.js";
import getStreamingActions from "./streaming-actions.js";
import getMultiviewActions from "./multiview-actions.js";
import getCountdownActions from "./countdown-actions.js";
import getScreenTimerActions from "./screen-timer-actions.js";

export default function (instance) {
  return {
    ...getLookActions(instance),
    ...getSelectedLayerActions(instance),
    ...getTimelineActions(instance),
    ...getMiscActions(instance),
    ...getMixerLayerActions(instance),
    ...getPipOverlayActions(instance),
    ...getStreamingActions(instance),
    ...getMultiviewActions(instance),
    ...getCountdownActions(instance),
    ...getScreenTimerActions(instance),
  };
}
