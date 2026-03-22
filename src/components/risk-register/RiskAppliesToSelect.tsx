"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useRiskAppliesToOptions } from "./RiskAppliesToOptionsContext";

type RiskAppliesToSelectProps = {
  id: string;
  value: string;
  onChange: (name: string) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  /** First option: empty disabled “Select…” */
  allowEmptyPlaceholder?: boolean;
};

export function RiskAppliesToSelect({
  id,
  value,
  onChange,
  className,
  style,
  disabled,
  allowEmptyPlaceholder,
}: RiskAppliesToSelectProps) {
  const { appliesToOptions, loading, error } = useRiskAppliesToOptions();

  const nameSet = useMemo(() => new Set(appliesToOptions.map((r) => r.name)), [appliesToOptions]);
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
        aria-label="Applies to"
        value=""
      >
        <option value="">Loading applies to…</option>
      </select>
    );
  }

  if (error && appliesToOptions.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Applies-to unavailable — enter a value below.
        </p>
        <input
          id={id}
          type="text"
          className={className}
          style={style}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Applies to"
          aria-label="Applies to"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {error && appliesToOptions.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
      )}
      <select
        id={id}
        className={className}
        style={style}
        value={allowEmptyPlaceholder && value === "" ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Applies to"
      >
        {allowEmptyPlaceholder && (
          <option value="" disabled>
            Select applies to
          </option>
        )}
        {showLegacyOption && (
          <option value={value} key={`legacy-${value}`}>
            {value}
          </option>
        )}
        {appliesToOptions.length === 0 ? (
          <option value="">No options configured</option>
        ) : (
          appliesToOptions.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
