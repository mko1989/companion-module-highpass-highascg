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

export default function (instance) {
  return {
    ...getLookActions(instance),
    ...getSelectedLayerActions(instance),
    ...getTimelineActions(instance),
    ...getMiscActions(instance),
    ...getMixerLayerActions(instance),
    ...getPipOverlayActions(instance),
  };
}
