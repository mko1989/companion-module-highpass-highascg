/** Feedbacks used by layered look recall buttons (PGM / PRV tally + preview). */
export const LOOK_AIR_FEEDBACKS = [
  "look_on_pgm",
  "look_on_prv_for_screen",
  "look_on_prv",
];

/**
 * @param {import('./instance.js').HighAsCGInstance} instance
 */
export function refreshLookAirFeedbacks(instance) {
  instance.checkFeedbacks(...LOOK_AIR_FEEDBACKS);
}
