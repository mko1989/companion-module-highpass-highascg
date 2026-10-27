/**
 * @file global-border-presets.js
 * One global-border toggle per screen (red while on), captioned with the screen's name variable.
 */

import { combineRgb } from "@companion-module/base";
import { connectionLabel } from "../connection-expressions.js";
import { SCREEN_LABEL_COUNT, screenLabelVariableId } from "../look-vars.js";
import { GLOBAL_BORDER_SCREENS } from "../global-borders.js";

const WHITE = combineRgb(255, 255, 255);
const BLACK = combineRgb(0, 0, 0);
const RED = combineRgb(200, 0, 0);

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {(sectionId: string, key: string, preset: object) => void} add
 */
export function addGlobalBorderPresets(instance, add) {
  const map = instance?._channelMap;
  const count = Math.min(
    GLOBAL_BORDER_SCREENS,
    Math.max(1, Number(map?.screenCount) || map?.programChannels?.length || 1),
  );
  for (let i = 0; i < count; i++) {
    const label =
      i < SCREEN_LABEL_COUNT
        ? `$(${connectionLabel(instance)}:${screenLabelVariableId(i)})`
        : `S${i + 1}`;
    add("global_border", `global_border_toggle_${i + 1}`, {
      type: "simple",
      name: `Global border toggle: screen ${i + 1}`,
      style: {
        text: `BORDER\\n${label}`,
        size: "14",
        color: WHITE,
        bgcolor: BLACK,
      },
      steps: [
        {
          down: [
            {
              actionId: "global_border_set",
              options: { screen: String(i), state: "toggle" },
            },
          ],
          up: [],
        },
      ],
      feedbacks: [
        {
          feedbackId: "global_border_on",
          options: { screen: String(i) },
          style: { bgcolor: RED, color: WHITE },
        },
      ],
    });
  }
}
