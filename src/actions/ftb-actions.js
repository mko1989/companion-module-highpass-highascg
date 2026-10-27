/**
 * @file ftb-actions.js
 * Fade to black — the web UI's per-screen FTB button (POST /api/ftb): every layer on the screen's
 * program AND preview channel fades out, then the channels are cleared and the screen's live look
 * is dropped. "All screens" is the same call without a screen (it also stops a running timeline).
 */

import { screenDisplayLabel } from "../look-vars.js";

/** 0.5 s at 50p — what the web FTB button sends. */
const DEFAULT_FRAMES = 25;

const TWEENS = [
  "linear",
  "easeinsine",
  "easeoutsine",
  "easeinoutsine",
  "easeinquad",
  "easeoutquad",
  "easeinoutquad",
  "easeincubic",
  "easeoutcubic",
  "easeinoutcubic",
];

/** Screens from the live channel map (names follow HighAsCG's screen labels). */
export function buildScreenDropdown(instance) {
  const map = instance?._channelMap;
  const count = Math.max(
    1,
    Number(map?.screenCount) || map?.programChannels?.length || 1,
  );
  const choices = Array.from({ length: count }, (_, i) => {
    const label = screenDisplayLabel(map, i);
    return {
      id: String(i),
      label:
        label === `S${i + 1}`
          ? `Screen ${i + 1}`
          : `Screen ${i + 1} · ${label}`,
    };
  });
  return { choices, default: "0" };
}

/** Fade options shared by both actions. */
const fadeOptions = () => [
  {
    type: "number",
    id: "durationFrames",
    label: "Fade (frames at the screen's rate)",
    default: DEFAULT_FRAMES,
    // The server clamps to 1-120 and treats 0 as its 25-frame default — there is no cut.
    min: 1,
    max: 120,
  },
  {
    type: "dropdown",
    id: "tween",
    label: "Tween",
    default: "linear",
    choices: TWEENS.map((t) => ({ id: t, label: t })),
  },
];

export default function (instance) {
  /** @param {object} action @param {number | null} screenIdx */
  const ftb = async (action, screenIdx) => {
    const api = instance.bridge?.api;
    if (!api) return;
    const body = {
      durationFrames: Math.max(
        1,
        Math.min(
          120,
          parseInt(action.options?.durationFrames, 10) || DEFAULT_FRAMES,
        ),
      ),
      tween: String(action.options?.tween || "linear"),
    };
    if (screenIdx != null) body.screenIdx = screenIdx;
    try {
      await api.fadeToBlack(body);
    } catch (e) {
      instance.log(
        "error",
        `Fade to black (${screenIdx == null ? "all screens" : `screen ${screenIdx + 1}`}): ${e.message || e}`,
      );
    }
  };

  return {
    ftb_screen: {
      name: "Fade to black: Screen",
      description:
        "Fades the screen's program and preview to black, then clears them (same as the FTB button on the screen's look column).",
      options: [
        {
          type: "dropdown",
          id: "screen",
          label: "Screen",
          ...buildScreenDropdown(instance),
        },
        ...fadeOptions(),
      ],
      callback: async (action) => {
        const idx = parseInt(action.options?.screen, 10);
        await ftb(action, Number.isFinite(idx) && idx >= 0 ? idx : 0);
      },
    },

    ftb_all: {
      name: "Fade to black: All screens",
      description:
        "Stops a running timeline, fades every screen's program and preview to black, then clears them.",
      options: fadeOptions(),
      callback: async (action) => ftb(action, null),
    },
  };
}
