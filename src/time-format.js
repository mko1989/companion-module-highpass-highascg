/**
 * Format a millisecond value as HH:MM:SS (floor to whole seconds).
 * @param {number | string | null | undefined} ms
 * @returns {string} empty if invalid / unknown
 */
function msToHms(ms) {
  if (ms == null || ms === "") return "";
  const n = Number(ms);
  if (Number.isNaN(n)) return "";
  const floored = Math.max(0, Math.floor(n));
  const totalSec = Math.floor(floored / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export { msToHms };
