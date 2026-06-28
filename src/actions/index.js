/**
 * @file index.js (actions)
 * Merges and returns all action definitions.
 */

import getBasicActions from "./basic-actions.js";
import getHighAsCGActions from "./highascg-actions.js";

export default function (instance) {
  return {
    ...getBasicActions(instance),
    ...getHighAsCGActions(instance),
  };
}
