"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useRiskProjectOwners } from "./RiskProjectOwnersContext";
import { dlog } from "@/lib/debug";

/** Select this value to type a new owner name (inserted on form submit or new-name blur). */
export const NEW_RISK_OWNER_SENTINEL = "__risk_owner_new__";

/** Stable `<option>` values so owner names never collide with `value=""` or duplicate labels. */
const OWNER_OPTION_PREFIX = "__risk_owner_row_id__:";

function toSelectElementValue(
  selectValue: string,
  owners: { id: string; name: string }[]
): string {
  if (selectValue === NEW_RISK_OWNER_SENTINEL) return NEW_RISK_OWNER_SENTINEL;
  if (selectValue === "") return "";
  const match = owners.find((o) => o.name === selectValue);
  if (match) return `${OWNER_OPTION_PREFIX}${match.id}`;
  return selectValue;
}

function fromSelectElementValue(
  v: string,
  owners: { id: string; name: string }[]
): string {
  if (v === NEW_RISK_OWNER_SENTINEL) return NEW_RISK_OWNER_SENTINEL;
  if (v === "") return "";
  if (v.startsWith(OWNER_OPTION_PREFIX)) {
    const id = v.slice(OWNER_OPTION_PREFIX.length);
    return owners.find((o) => o.id === id)?.name ?? "";
  }
  return v;
}

export function getResolvedOwnerPickerValue(selectValue: string, newNameDraft: string): string {
  if (selectValue === NEW_RISK_OWNER_SENTINEL) return newNameDraft.trim();
  return selectValue.trim();
}

export function shouldPersistNewOwnerOnSubmit(selectValue: string): boolean {
  return selectValue === NEW_RISK_OWNER_SENTINEL;
}

type RiskOwnerPickerProps = {
  id: string;
  selectValue: string;
  newNameDraft: string;
  onSelectChange: (next: string) => void;
  onNewNameDraftChange: (next: string) => void;
  /** When the user finishes typing a new owner (inline register row). */
  onNewNameInputBlur?: () => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  allowEmptyPlaceholder?: boolean;
};

export function RiskOwnerPicker({
  id,
  selectValue,
  newNameDraft,
  onSelectChange,
  onNewNameDraftChange,
  onNewNameInputBlur,
  className,
  style,
  disabled,
  allowEmptyPlaceholder,
}: RiskOwnerPickerProps) {
  const { owners, loading, error } = useRiskProjectOwners();
  const nameSet = useMemo(() => new Set(owners.map((o) => o.name)), [owners]);
  const ownersForOptions = useMemo(
    () => owners.filter((o) => o.name.trim().length > 0),
    [owners]
  );

  const showLegacyOption =
    selectValue !== "" &&
    selectValue !== NEW_RISK_OWNER_SENTINEL &&
    !nameSet.has(selectValue);

  if (loading) {
    return (
      <select
        id={id}
        disabled
        className={className}
        style={style}
        aria-busy="true"
        aria-label="Owner"
        value=""
      >
        <option value="">Loading owners…</option>
      </select>
    );
  }

  if (error && owners.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Owners unavailable — enter owner name as text.
        </p>
        <input
          id={id}
          type="text"
          className={className}
          style={style}
          value={selectValue === NEW_RISK_OWNER_SENTINEL ? newNameDraft : selectValue}
          onChange={(e) => {
            const t = e.target.value;
            if (selectValue === NEW_RISK_OWNER_SENTINEL) {
              onNewNameDraftChange(t);
            } else {
              onSelectChange(t);
            }
          }}
          disabled={disabled}
          placeholder="Owner"
          aria-label="Owner"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {error && owners.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
      )}
      <select
        id={id}
        className={className}
        style={style}
        value={toSelectElementValue(selectValue, ownersForOptions)}
        onChange={(e) => {
          const v = e.target.value;
          const logical = fromSelectElementValue(v, ownersForOptions);
          dlog("[risk owner] select change", { raw: v, logical, addNewMode: logical === NEW_RISK_OWNER_SENTINEL });
          onSelectChange(logical);
        }}
        disabled={disabled}
        aria-label="Owner"
      >
        {allowEmptyPlaceholder && (
          <option value="" disabled>
            Select owner
          </option>
        )}
        {!allowEmptyPlaceholder && <option value="">—</option>}
        {showLegacyOption && (
          <option value={selectValue} key={`legacy-owner-${selectValue}`}>
            {selectValue}
          </option>
        )}
        {ownersForOptions.map((o) => (
          <option key={o.id} value={`${OWNER_OPTION_PREFIX}${o.id}`}>
            {o.name}
          </option>
        ))}
        <option value={NEW_RISK_OWNER_SENTINEL}>Add new owner…</option>
      </select>
      {selectValue === NEW_RISK_OWNER_SENTINEL && (
        <input
          id={`${id}-new-name`}
          type="text"
          className={className}
          style={style}
          value={newNameDraft}
          onChange={(e) => onNewNameDraftChange(e.target.value)}
          onBlur={() => onNewNameInputBlur?.()}
          disabled={disabled}
          placeholder="New owner name"
          aria-label="New owner name"
        />
      )}
    </div>
  );
}
