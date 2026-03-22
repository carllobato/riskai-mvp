"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useRiskCategoryOptions } from "./RiskCategoryOptionsContext";

type RiskCategorySelectProps = {
  id: string;
  value: string;
  onChange: (name: string) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  /** First option: empty disabled “Select…” (detail modal) */
  allowEmptyPlaceholder?: boolean;
};

export function RiskCategorySelect({
  id,
  value,
  onChange,
  className,
  style,
  disabled,
  allowEmptyPlaceholder,
}: RiskCategorySelectProps) {
  const { categories, loading, error } = useRiskCategoryOptions();

  const nameSet = useMemo(() => new Set(categories.map((c) => c.name)), [categories]);
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
        aria-label="Category"
        value=""
      >
        <option value="">Loading categories…</option>
      </select>
    );
  }

  if (error && categories.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Categories unavailable — enter a category name below.
        </p>
        <input
          id={id}
          type="text"
          className={className}
          style={style}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Category"
          aria-label="Category"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {error && categories.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
      )}
      <select
        id={id}
        className={className}
        style={style}
        value={allowEmptyPlaceholder && value === "" ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Category"
      >
        {allowEmptyPlaceholder && (
          <option value="" disabled>
            Select category
          </option>
        )}
        {showLegacyOption && (
          <option value={value} key={`legacy-${value}`}>
            {value}
          </option>
        )}
        {categories.length === 0 ? (
          <option value="">No categories configured</option>
        ) : (
          categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
