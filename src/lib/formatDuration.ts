/**
 * Canonical duration formatting for schedule/Programme display.
 * Input is always in days. Used consistently for P20/P50/P80/P90 tiles and time charts.
 *
 * Rules:
 * - Under 14 days: show "X day(s)" (no rounding that turns 10 into 1 week).
 * - 14 days and above: show weeks with one decimal, e.g. "2.0 weeks" (no floor/round that loses precision).
 */

const DAYS_THRESHOLD_WEEKS = 14;

/**
 * Format a duration in days for display.
 * - undefined/NaN/negative → "—"
 * - 0 → "0 days"
 * - 1 → "1 day"
 * - 2..13 → "X days"
 * - 14+ → "(days/7).toFixed(1) weeks" (e.g. 14 → "2.0 weeks", 10 would be "10 days")
 */
export function formatDurationDays(days: number | undefined): string {
  if (days == null || !Number.isFinite(days) || days < 0) return "—";
  if (days < DAYS_THRESHOLD_WEEKS) {
    const n = Math.round(days);
    return n === 1 ? "1 day" : `${n.toLocaleString()} days`;
  }
  const weeks = days / 7;
  return `${weeks.toFixed(1)} weeks`;
}
