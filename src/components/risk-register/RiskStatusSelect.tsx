"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useRiskStatusOptions } from "./RiskStatusOptionsContext";

type RiskStatusSelectProps = {
  id: string;
  value: string;
  onChange: (name: string) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  /** First option: empty disabled “Select…” */
  allowEmptyPlaceholder?: boolean;
};

export function RiskStatusSelect({
  id,
  value,
  onChange,
  className,
  style,
  disabled,
  allowEmptyPlaceholder,
}: RiskStatusSelectProps) {
  const { statuses, loading, error } = useRiskStatusOptions();

  const nameSet = useMemo(() => new Set(statuses.map((s) => s.name)), [statuses]);
  const hasCurrentInList = value !== "" && nameSet.has(value);
  const showLegacyOption = value !== "" && !hasCurrentInList;

  if (loading) {
    return (
      <select
        id={id}
        disabled
        className={className}
        style={style}
        aria-busy="true"
        aria-label="Status"
        value=""
      >
        <option value="">Loading statuses…</option>
      </select>
    );
  }

  if (error && statuses.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Statuses unavailable — enter a status name below.
        </p>
        <input
          id={id}
          type="text"
          className={className}
          style={style}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Status"
          aria-label="Status"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {error && statuses.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
      )}
      <select
        id={id}
        className={className}
        style={style}
        value={allowEmptyPlaceholder && value === "" ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Status"
      >
        {allowEmptyPlaceholder && (
          <option value="" disabled>
            Select status
          </option>
        )}
        {showLegacyOption && (
          <option value={value} key={`legacy-${value}`}>
            {value}
          </option>
        )}
        {statuses.length === 0 ? (
          <option value="">No statuses configured</option>
        ) : (
          statuses.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
