export type PercentileItem = {
  label: string;
  value: string;
};

type ForecastSummaryCardProps = {
  title: string;
  percentiles: PercentileItem[];
  emptyMessage?: string;
};

/**
 * Card displaying forecast percentiles (e.g. P10, P50, P80, P90) for cost or schedule.
 */
export function ForecastSummaryCard({
  title,
  percentiles,
  emptyMessage = "No forecast data",
}: ForecastSummaryCardProps) {
  const hasData = percentiles.length > 0 && percentiles.some((p) => p.value !== "—" && p.value !== "");

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
      <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
        {title}
      </h2>
      <div className="p-4">
        {!hasData ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">{emptyMessage}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {percentiles.map(({ label, value }) => (
              <div key={label} className="rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-3">
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  {label}
                </div>
                <div className="mt-0.5 text-lg font-semibold text-[var(--foreground)]">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
