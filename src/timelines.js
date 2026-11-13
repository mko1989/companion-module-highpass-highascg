/**
 * @file timelines.js
 * Timeline list + playback as the module sees them (from HighAsCG state.timeline), the "Timeline"
 * dropdown every timeline action / feedback uses, and the id an action really targets.
 *
 * "" in the dropdown = the ACTIVE timeline: the one playing, else the one open in HighAsCG's timeline
 * editor, else the last played, else the first of the show. A button made from a preset therefore works
 * without typing an id, which the old free-text "Timeline id" field required (an empty field did nothing).
 */

export const ACTIVE = "";

/** @returns {{ list: object[], playback: object | null, activeId: string }} */
export function timelineState(instance) {
  const tl = instance?.bridge?.sync?._merged?.timeline || {};
  return {
    list: Array.isArray(tl.list)
      ? tl.list.filter((t) => t && t.id != null)
      : [],
    playback:
      tl.playback && typeof tl.playback === "object" ? tl.playback : null,
    activeId: tl.activeId != null ? String(tl.activeId) : "",
  };
}

/**
 * The project carries the timeline list and the one open in the editor (`timelines.activeId`).
 * HighAsCG's state snapshot has the list only at connect; project_sync keeps it current.
 */
export function ingestProjectTimelines(instance, project) {
  const t = project?.timelines;
  if (!t || !Array.isArray(t.timelines)) return;
  instance.handleBridgeState?.({
    timeline: {
      list: t.timelines,
      activeId: t.activeId != null ? String(t.activeId) : "",
    },
  });
}

/** Name of a timeline (falls back to its id). */
export function timelineName(t) {
  return String(t?.name || t?.id || "");
}

/**
 * The id an action / feedback targets. `raw` is the option value: "" (active), a timeline id, or
 * (custom value / variable already parsed) a timeline NAME — matched case-insensitively.
 * @returns {string} "" when the show has no timeline at all
 */
export function resolveTimelineId(instance, raw) {
  const want = String(raw ?? "").trim();
  const { list, playback, activeId } = timelineState(instance);
  if (want) {
    if (list.some((t) => String(t.id) === want)) return want;
    const byName = list.find(
      (t) => timelineName(t).toLowerCase() === want.toLowerCase(),
    );
    if (byName) return String(byName.id);
    return want; // unknown here (list not loaded yet) — let the server answer
  }
  const known = (x) => x && list.some((t) => String(t.id) === x);
  const pid = playback?.timelineId != null ? String(playback.timelineId) : "";
  if (pid && playback.playing) return pid; // the running one
  if (known(activeId)) return activeId; // else the one open in the editor
  if (pid) return pid; // else the last played
  return list.length ? String(list[0].id) : "";
}

/** Playback of one timeline: playing only when HighAsCG's playback is THIS timeline. */
export function playbackOf(instance, id) {
  const { playback } = timelineState(instance);
  if (!playback || String(playback.timelineId ?? "") !== String(id ?? "")) {
    return { playing: false, position: 0, loop: false, active: false };
  }
  return {
    playing: !!playback.playing,
    position: Number(playback.position) || 0,
    loop: !!playback.loop,
    active: true,
  };
}

/** Dropdown option for actions / feedbacks. */
export function timelineOption(instance) {
  const { list } = timelineState(instance);
  return {
    type: "dropdown",
    id: "id",
    label: "Timeline",
    default: ACTIVE,
    allowCustom: true,
    tooltip:
      "Active = the playing timeline, else the one open in the HighAsCG editor. A custom value can be a timeline id or name.",
    choices: [
      { id: ACTIVE, label: "Active timeline" },
      ...list.map((t) => ({
        id: String(t.id),
        label: timelineName(t).slice(0, 60),
      })),
    ],
    minChoicesForSearch: 8,
  };
}

/** Changes when a timeline is added, removed or renamed (refresh dropdowns + presets). */
export function timelineListSignature(list) {
  return JSON.stringify(
    (Array.isArray(list) ? list : []).map((t) => [
      String(t?.id),
      timelineName(t),
    ]),
  );
}
