type PositionBarProps = {
  label: string;
  p10: number;
  p50: number;
  p90: number;
  formatValue: (n: number) => string;
  valueLabel: string;
  /** Optional: show current position (e.g. contingency or schedule buffer) on the bar */
  currentPosition?: number | null;
};

function p80FromP50P90(p50: number, p90: number): number {
  return (p50 + p90) / 2;
}

/**
 * Position bar with three zones (Exposed | At Risk | Controlled), P50/P80 markers,
 * and optional current position indicator. Minimal styling, no gradients.
 */
export function PositionBar({
  label,
  p10,
  p50,
  p90,
  formatValue,
  valueLabel,
  currentPosition = null,
}: PositionBarProps) {
  const p80 = p80FromP50P90(p50, p90);
  const range = p90 - p10;
  const toPct = (v: number) =>
    range > 0 && Number.isFinite(v) ? Math.max(0, Math.min(100, ((v - p10) / range) * 100)) : 50;

  const p50Pct = toPct(p50);
  const p80Pct = toPct(p80);
  const currentPct = currentPosition != null && Number.isFinite(currentPosition) ? toPct(currentPosition) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
        <span className="text-sm tabular-nums text-[var(--foreground)]">
          {valueLabel} {formatValue(p50)}
        </span>
      </div>
      {/* Bar with three zones */}
      <div
        className="relative h-2 w-full rounded-full overflow-hidden flex"
        role="img"
        aria-label={`${label}: ${valueLabel} at ${formatValue(p50)}; range ${formatValue(p10)} to ${formatValue(p90)}`}
      >
        <div className="flex-1 h-full bg-emerald-500/10 dark:bg-emerald-500/15" title="Controlled" />
        <div className="flex-1 h-full bg-amber-500/10 dark:bg-amber-500/15" title="At Risk" />
        <div className="flex-1 h-full bg-red-500/10 dark:bg-red-500/15" title="Exposed" />
        {/* P50 marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-[var(--foreground)]/60"
          style={{ left: `${p50Pct}%` }}
          aria-hidden
        />
        {/* P80 marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-[var(--foreground)]/40"
          style={{ left: `${p80Pct}%` }}
          aria-hidden
        />
        {/* Current position indicator */}
        {currentPct != null && (
          <div
            className="absolute top-0 bottom-0 w-1 -translate-x-1/2 rounded-full bg-[var(--foreground)]"
            style={{ left: `${currentPct}%` }}
            title="Current position"
            aria-hidden
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>Controlled</span>
        <span>At Risk</span>
        <span>Exposed</span>
      </div>
      <div className="flex justify-between text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
        <span>{formatValue(p10)}</span>
        <span>{formatValue(p90)}</span>
      </div>
    </div>
  );
}
