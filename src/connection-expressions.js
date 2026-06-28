/** Manifest id — fallback when instance label is unavailable in preset builders. */
export const MODULE_ID = "highpass-highascg";

/**
 * Companion connection label for variable expressions (user instance name, not module id).
 *
 * @param {import('./instance.js').HighAsCGInstance | null | undefined} instance
 */
export function connectionLabel(instance) {
  const label = instance?.label;
  return label && String(label).trim() ? String(label).trim() : MODULE_ID;
}

/**
 * @param {import('./instance.js').HighAsCGInstance | null | undefined} instance
 * @param {string} variableId — includes highascg_ prefix
 */
export function connectionVariableExpression(instance, variableId) {
  return {
    isExpression: true,
    value: `$(${connectionLabel(instance)}:${variableId})`,
  };
}

/**
 * @template T
 * @param {T} value
 */
export function presetLiteral(value) {
  return { isExpression: false, value };
}

/**
 * @param {string} expression
 */
export function presetExpression(expression) {
  return { isExpression: true, value: expression };
}
