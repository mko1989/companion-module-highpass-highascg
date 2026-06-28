/**
 * @file action-options.js
 * Shared option builders and mixer helpers for HighAsCG actions.
 */

import { resolveUiLayerRouting } from "../ui-selection.js";

export function defaultSendTo(action) {
  const screenIdx = Math.max(0, parseInt(action.options.screen_index, 10) || 0);
  return {
    preview: action.options.tl_preview !== false,
    program: action.options.tl_program !== false,
    screenIdx,
  };
}

export const EFFECT_TYPE_CHOICES = [
  { id: "blend_mode", label: "blend_mode" },
  { id: "brightness", label: "brightness" },
  { id: "contrast", label: "contrast" },
  { id: "saturation", label: "saturation" },
  { id: "levels", label: "levels" },
  { id: "chroma_key", label: "chroma_key" },
  { id: "crop", label: "crop" },
  { id: "clip_mask", label: "clip_mask" },
  { id: "perspective", label: "perspective" },
  { id: "grid", label: "grid" },
  { id: "keyer", label: "keyer" },
  { id: "rotation", label: "rotation" },
  { id: "anchor", label: "anchor" },
];

export function baseChannelLayerOptions() {
  return [
    {
      type: "number",
      label: "Channel",
      id: "channel",
      default: 1,
      min: 1,
      max: 8,
    },
    {
      type: "number",
      label: "Layer",
      id: "layer",
      default: 20,
      min: 0,
      max: 9999,
    },
  ];
}

export function mixerTransitionOptions(defaultDuration = 0) {
  return [
    {
      type: "number",
      label: "Duration (frames, 0 = immediate)",
      id: "duration",
      default: defaultDuration,
      min: 0,
      max: 999999,
    },
    {
      type: "textinput",
      label: "Tween (blank = default)",
      id: "tween",
      default: "",
    },
    {
      type: "checkbox",
      label: "Defer apply",
      id: "defer",
      default: false,
    },
  ];
}

export function parseTransitionOptions(options) {
  const duration = Number(options.duration);
  const tween = String(options.tween || "").trim();
  return {
    ...(Number.isFinite(duration) && duration > 0 ? { duration } : {}),
    ...(tween ? { tween } : {}),
    ...(options.defer ? { defer: true } : {}),
  };
}

export async function applyMixerFillToUiSelection(instance, fillBody, transitionOpts) {
  const route = resolveUiLayerRouting(instance);
  if (!route.ok) {
    instance.log(
      "warn",
      `Selected layer fill: ${route.reason || "cannot resolve channel/layer"}`,
    );
    return;
  }
  await instance.bridge.api.mixerFill({
    channel: route.channel,
    layer: route.layer,
    ...fillBody,
    ...parseTransitionOptions(transitionOpts || {}),
  });
}
