import { filterLooksForScreen, mainScopeShortLabel } from "../look-scope.js";

/**
 * Dropdown choices for Take look — driven by instance._presetLooks (from HighAsCG project).
 * @param {{ _presetLooks?: { id: string, name: string, mainScope?: string }[] }} instance
 * @param {number | null | undefined} [screenIndex] — when set, only looks for that screen (+ "all")
 * @returns {{ choices: { id: string, label: string }[], default: string, minChoicesForSearch?: number }}
 */
function buildLookDropdown(instance, screenIndex) {
  let looks = Array.isArray(instance._presetLooks) ? instance._presetLooks : [];
  if (screenIndex != null && screenIndex !== "") {
    looks = filterLooksForScreen(looks, screenIndex);
  }
  if (looks.length === 0) {
    return {
      choices: [
        {
          id: "",
          label:
            screenIndex != null && screenIndex !== ""
              ? `(No looks for screen ${(parseInt(screenIndex, 10) || 0) + 1} — check mainScope in HighAsCG)`
              : "(No looks — open HighAsCG web UI to sync, or save project)",
        },
      ],
      default: "",
    };
  }
  return {
    choices: looks.map((l) => ({
      id: l.id,
      label: `${(l.name || l.id).slice(0, 56)} · ${mainScopeShortLabel(l.mainScope)} (${l.id.slice(0, 8)})`,
    })),
    default: looks[0].id,
    minChoicesForSearch: 8,
  };
}

export { buildLookDropdown };
