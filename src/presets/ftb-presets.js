/**
 * @file ftb-presets.js
 * Fade-to-black buttons: one master "all screens" and one per screen that exists. Screen names are
 * read from the screen-label variables, so a renamed screen re-captions the button.
 */

import { combineRgb } from "@companion-module/base";
import { connectionLabel } from "../connection-expressions.js";
import { SCREEN_LABEL_COUNT, screenLabelVariableId } from "../look-vars.js";

const WHITE = combineRgb(255, 255, 255);
const BLACK = combineRgb(0, 0, 0);
const DARK_RED = combineRgb(110, 0, 0);

const fade = { durationFrames: 25, tween: "linear" };

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {(sectionId: string, key: string, preset: object) => void} add
 */
export function addFtbPresets(instance, add) {
  add("ftb", "ftb_all", {
    type: "simple",
    name: "Fade to black: all screens",
    style: { text: "FTB\\nALL", size: "18", color: WHITE, bgcolor: DARK_RED },
    steps: [{ down: [{ actionId: "ftb_all", options: { ...fade } }], up: [] }],
    feedbacks: [],
  });

  const map = instance?._channelMap;
  const count = Math.max(
    1,
    Number(map?.screenCount) || map?.programChannels?.length || 1,
  );
  for (let i = 0; i < count; i++) {
    // Label variables exist for the first SCREEN_LABEL_COUNT screens; past that, a plain number.
    const label =
      i < SCREEN_LABEL_COUNT
        ? `$(${connectionLabel(instance)}:${screenLabelVariableId(i)})`
        : `S${i + 1}`;
    add("ftb", `ftb_screen_${i + 1}`, {
      type: "simple",
      name: `Fade to black: screen ${i + 1}`,
      style: {
        text: `FTB\\n${label}`,
        size: "18",
        color: WHITE,
        bgcolor: BLACK,
      },
      steps: [
        {
          down: [
            { actionId: "ftb_screen", options: { screen: String(i), ...fade } },
          ],
          up: [],
        },
      ],
      feedbacks: [],
    });
  }
}
