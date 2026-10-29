/**
 * @file pgm-readback-presets.js
 * PGM readback (HighAsCG WO-803): one display-only button per screen — the screen's main PGM layer, remaining time
 * and a progress bar, drawn by the `pgm_layer_readback` feedback. No actions: pressing the button does nothing.
 * The single empty step is the shape Companion needs for a button; it holds no actions.
 */

import { combineRgb } from "@companion-module/base";
import { connectionLabel } from "../connection-expressions.js";
import {
  screenDisplayLabel,
  SCREEN_LABEL_COUNT,
  screenLabelVariableId,
} from "../look-vars.js";
import { PGM_READBACK_FEEDBACK_ID } from "../pgm-layers.js";

const DIM = combineRgb(110, 110, 110);
const BG = combineRgb(20, 20, 24);

/**
 * @param {import('../instance.js').HighAsCGInstance} instance
 * @param {(sectionId: string, key: string, preset: object) => void} add
 */
export function addPgmReadbackPresets(instance, add) {
  const map = instance?._channelMap;
  const count = Math.max(
    1,
    Number(map?.screenCount) || map?.programChannels?.length || 1,
  );
  for (let i = 0; i < count; i++) {
    // Base caption follows a screen rename (variable); the feedback replaces it with the live readback.
    const label =
      i < SCREEN_LABEL_COUNT
        ? `$(${connectionLabel(instance)}:${screenLabelVariableId(i)})`
        : `S${i + 1}`;
    add("pgm_readback", `pgm_readback_screen_${i + 1}`, {
      type: "simple",
      name: `PGM readback — ${screenDisplayLabel(map, i)}`,
      keywords: ["pgm", "remaining", "progress", "countdown", "readback"],
      style: {
        text: `${label}\\n--:--`,
        size: "14",
        color: DIM,
        bgcolor: BG,
      },
      steps: [{ down: [], up: [] }],
      feedbacks: [
        {
          feedbackId: PGM_READBACK_FEEDBACK_ID,
          options: { screen: String(i) },
        },
      ],
    });
  }
}
