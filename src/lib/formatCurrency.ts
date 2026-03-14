/**
 * Format currency for dashboard display (e.g. $24.6M, $1.2K).
 * Used by Project Overview and Portfolio Overview.
 */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value >= 1_000_000_000) {
    const billions = value / 1_000_000_000;
    return `$${billions % 1 === 0 ? billions : billions.toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions % 1 === 0 ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `$${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format ratio for display (e.g. 1.28x, 0.92x). */
export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${ratio.toFixed(2)}x`;
}
