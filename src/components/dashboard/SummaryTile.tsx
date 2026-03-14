type SummaryTileProps = {
  title: string;
  primaryValue: string;
  subtext?: string;
};

/**
 * KPI summary tile: title, large primary value, optional contextual subtext.
 */
export function SummaryTile({ title, primaryValue, subtext }: SummaryTileProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 flex flex-col min-h-[88px]">
      <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 m-0 mb-1">
        {title}
      </p>
      <p className="text-2xl font-semibold text-[var(--foreground)] m-0 tracking-tight">
        {primaryValue}
      </p>
      {subtext != null && subtext !== "" && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 m-0">
          {subtext}
        </p>
      )}
    </div>
  );
}
