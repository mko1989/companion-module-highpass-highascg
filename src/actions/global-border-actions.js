/**
 * @file global-border-actions.js
 * Per-screen global border (the web "Global Border" inspector): on / off / toggle, style changes
 * and preset recall — all POST /api/scene/global-border, which switches the border on air and
 * saves it to the project (web UIs follow). Style changes while the border is on update it live.
 */

import { buildScreenDropdown } from "./ftb-actions.js";
import {
  GLOBAL_BORDER_COLOR_KEYS,
  GLOBAL_BORDER_PARAM_KEYS,
  GLOBAL_BORDER_TYPES,
  ingestGlobalBorderSlot,
} from "../global-borders.js";

/**
 * `"+5"` / `"-0.1"` nudge the current value; `true|false` switch; anything else numeric sets.
 * @returns {number | boolean | null} null = not a usable value
 */
export function parseParamValue(raw, current) {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  if (/^(true|on|yes)$/i.test(s)) return true;
  if (/^(false|off|no)$/i.test(s)) return false;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (/^[+-]/.test(s) && Number.isFinite(Number(current))) {
    return Math.round((Number(current) + n) * 1e6) / 1e6;
  }
  return n;
}

export default function (instance) {
  const screenOption = () => ({
    type: "dropdown",
    id: "screen",
    label: "Screen",
    ...buildScreenDropdown(instance),
  });
  const screenOf = (action) =>
    Math.max(0, parseInt(action.options?.screen, 10) || 0);
  const slotOf = (i) => instance._globalBorders?.[i] || null;

  /** @param {number} screen @param {object} body */
  const send = async (screen, body, what) => {
    const api = instance.bridge?.api;
    if (!api) return;
    try {
      const res = await api.globalBorder({ screen, ...body });
      ingestGlobalBorderSlot(instance, screen, res?.border);
    } catch (e) {
      instance.log(
        "error",
        `Global border ${what} (screen ${screen + 1}): ${e.message || e}`,
      );
    }
  };

  return {
    global_border_set: {
      name: "Global border: On / Off / Toggle",
      description:
        "Switches the screen's global border (fades with the border's fade setting). A screen with no border set up starts from the default red border.",
      options: [
        screenOption(),
        {
          type: "dropdown",
          id: "state",
          label: "State",
          default: "toggle",
          choices: [
            { id: "toggle", label: "Toggle" },
            { id: "on", label: "On" },
            { id: "off", label: "Off" },
          ],
        },
      ],
      callback: async (action) => {
        const st = String(action.options?.state || "toggle");
        const enabled = st === "on" ? true : st === "off" ? false : "toggle";
        await send(screenOf(action), { enabled }, st);
      },
    },

    global_border_color: {
      name: "Global border: Set colour",
      options: [
        screenOption(),
        {
          type: "dropdown",
          id: "key",
          label: "Which colour",
          default: "color",
          choices: GLOBAL_BORDER_COLOR_KEYS,
        },
        {
          type: "colorpicker",
          id: "color",
          label: "Colour",
          default: "#e63946",
          returnType: "string",
        },
      ],
      callback: async (action) => {
        const key = String(action.options?.key || "color");
        const color = String(action.options?.color || "").trim();
        if (!color) return;
        await send(screenOf(action), { params: { [key]: color } }, "colour");
      },
    },

    global_border_opacity: {
      name: "Global border: Set opacity",
      description: "0–100 %. Use +10 / -10 to nudge from the current value.",
      options: [
        screenOption(),
        {
          type: "textinput",
          id: "opacity",
          label: "Opacity % (or +N / -N)",
          default: "100",
          useVariables: true,
        },
      ],
      callback: async (action) => {
        const i = screenOf(action);
        const cur = slotOf(i)?.params?.opacity;
        const pct = parseParamValue(
          action.options?.opacity,
          cur != null ? Number(cur) * 100 : 100,
        );
        if (typeof pct !== "number") return;
        const opacity = Math.max(0, Math.min(100, pct)) / 100;
        await send(i, { params: { opacity } }, "opacity");
      },
    },

    global_border_param: {
      name: "Global border: Set parameter",
      description:
        "Any border setting (width, speed, pulse…). Numbers set the value, +N / -N nudge it, true / false switch on-off settings. The border type decides which settings it reads.",
      options: [
        screenOption(),
        {
          type: "dropdown",
          id: "key",
          label: "Parameter",
          default: "width",
          choices: GLOBAL_BORDER_PARAM_KEYS,
        },
        {
          type: "textinput",
          id: "value",
          label: "Value (or +N / -N)",
          default: "",
          useVariables: true,
        },
      ],
      callback: async (action) => {
        const i = screenOf(action);
        const key = String(action.options?.key || "");
        if (!key) return;
        const v = parseParamValue(
          action.options?.value,
          slotOf(i)?.params?.[key],
        );
        if (v === null) {
          instance.log(
            "warn",
            `Global border: "${action.options?.value}" is not a value for ${key}`,
          );
          return;
        }
        await send(i, { params: { [key]: v } }, key);
      },
    },

    global_border_type: {
      name: "Global border: Set type",
      options: [
        screenOption(),
        {
          type: "dropdown",
          id: "type",
          label: "Type",
          default: "border",
          choices: GLOBAL_BORDER_TYPES,
        },
      ],
      callback: async (action) =>
        send(
          screenOf(action),
          { type: String(action.options?.type || "border") },
          "type",
        ),
    },

    global_border_fade: {
      name: "Global border: Set fade duration",
      description: "Frames used when the border fades on / off (0 = cut).",
      options: [
        screenOption(),
        {
          type: "number",
          id: "frames",
          label: "Fade (frames)",
          default: 25,
          min: 0,
          max: 500,
        },
      ],
      callback: async (action) =>
        send(
          screenOf(action),
          {
            fadeDuration: Math.max(
              0,
              parseInt(action.options?.frames, 10) || 0,
            ),
          },
          "fade",
        ),
    },

    global_border_preset: {
      name: "Global border: Recall preset",
      description:
        "Recalls a border preset saved in the HighAsCG border inspector (turns the border on; crossfades if it is already on).",
      options: [
        screenOption(),
        {
          type: "number",
          id: "slot",
          label: "Preset slot",
          default: 1,
          min: 1,
          max: 99,
        },
      ],
      callback: async (action) =>
        send(
          screenOf(action),
          { preset: Math.max(1, parseInt(action.options?.slot, 10) || 1) },
          "preset",
        ),
    },
  };
}
