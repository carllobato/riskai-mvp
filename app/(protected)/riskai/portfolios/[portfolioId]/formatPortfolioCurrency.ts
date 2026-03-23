/**
 * Format large currency values for portfolio dashboard (e.g. $124.5M).
 */
export function formatPortfolioCurrency(value: number): string {
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
