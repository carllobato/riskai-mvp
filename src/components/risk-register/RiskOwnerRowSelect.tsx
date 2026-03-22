"use client";

import { useCallback, useEffect, useState } from "react";
import {
  NEW_RISK_OWNER_SENTINEL,
  RiskOwnerPicker,
  getResolvedOwnerPickerValue,
} from "./RiskOwnerPicker";
import { useRiskProjectOwners } from "./RiskProjectOwnersContext";
import { dlog } from "@/lib/debug";

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "transparent",
};

/**
 * Inline owner cell: updates the risk when choosing an existing owner immediately;
 * for “Add new owner…”, inserts on blur of the text field then commits the name.
 */
export function RiskOwnerRowSelect({
  riskId,
  owner,
  onCommit,
}: {
  riskId: string;
  owner: string | null | undefined;
  onCommit: (name: string) => void;
}) {
  const { createProjectOwner } = useRiskProjectOwners();
  const raw = (owner ?? "").trim();
  const normalized = raw === "Unassigned" ? "" : raw;

  const [selectValue, setSelectValue] = useState(normalized);
  const [newNameDraft, setNewNameDraft] = useState("");

  useEffect(() => {
    setSelectValue(normalized);
    setNewNameDraft("");
  }, [riskId, normalized]);

  const handleSelectChange = useCallback(
    (next: string) => {
      setSelectValue(next);
      if (next !== NEW_RISK_OWNER_SENTINEL) {
        setNewNameDraft("");
        onCommit(next.trim());
      }
    },
    [onCommit]
  );

  const handleNewBlur = useCallback(async () => {
    if (selectValue !== NEW_RISK_OWNER_SENTINEL) return;
    const resolved = getResolvedOwnerPickerValue(selectValue, newNameDraft);
    if (!resolved) return;
    try {
      await createProjectOwner(resolved);
    } catch {
      return;
    }
    setSelectValue(resolved);
    setNewNameDraft("");
    onCommit(resolved);
    dlog("[risk owner] row blur new owner", resolved);
  }, [selectValue, newNameDraft, createProjectOwner, onCommit]);

  return (
    <RiskOwnerPicker
      id={`risk-row-owner-${riskId}`}
      selectValue={selectValue}
      newNameDraft={newNameDraft}
      onSelectChange={handleSelectChange}
      onNewNameDraftChange={setNewNameDraft}
      onNewNameInputBlur={handleNewBlur}
      className="w-full min-w-0"
      style={selectStyle}
      allowEmptyPlaceholder={normalized === ""}
    />
  );
}
