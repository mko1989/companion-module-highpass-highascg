/**
 * @file upgrades.js
 * Companion upgrade scripts (run once per stored button when the module version changes).
 */

const ROUTING_DEFAULTS = {
  override_routing: false,
  screen_index: 0,
  tl_preview: false,
  tl_program: true,
};

/**
 * 1.0.5 — the 1.0.3 / 1.0.4 "Play / Pause" presets stored `timeline_toggle` without the routing options.
 * Companion 5 refuses an action with a missing option ("screen_index: A value must be provided"), so those
 * buttons did nothing. Fill the missing options with their defaults.
 */
export function fillTimelineRoutingOptions(_context, props) {
  const updatedActions = [];
  for (const action of props.actions || []) {
    if (
      action.actionId !== "timeline_toggle" &&
      action.actionId !== "timeline_play"
    ) {
      continue;
    }
    action.options = action.options || {};
    let changed = false;
    for (const [key, value] of Object.entries(ROUTING_DEFAULTS)) {
      if (action.options[key] === undefined) {
        action.options[key] = { isExpression: false, value };
        changed = true;
      }
    }
    if (changed) updatedActions.push(action);
  }
  return { updatedConfig: null, updatedActions, updatedFeedbacks: [] };
}

export const UpgradeScripts = [fillTimelineRoutingOptions];
