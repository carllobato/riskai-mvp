"use client";

import { useRiskRegister } from "@/store/risk-register.store";
import { getRandomDemoRisksToAdd } from "@/data/demoRisks";
import type { ProjectContext } from "@/lib/projectContext";

export type RiskRegisterHeaderProps = {
  projectContext?: ProjectContext | null;
  onAiReviewClick?: () => void;
  aiReviewLoading?: boolean;
  onGenerateAiRiskClick?: () => void;
  onSaveToServer?: () => void | Promise<void>;
  saveToServerLoading?: boolean;
};

export function RiskRegisterHeader({
  onAiReviewClick,
  aiReviewLoading = false,
  onGenerateAiRiskClick,
  onSaveToServer,
  saveToServerLoading = false,
}: RiskRegisterHeaderProps) {
  const { clearRisks, addRisk, appendRisks } = useRiskRegister();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Risk Register</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onSaveToServer && (
          <button
            type="button"
            onClick={() => onSaveToServer()}
            disabled={saveToServerLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50 disabled:pointer-events-none"
          >
            {saveToServerLoading ? "Saving…" : "Save"}
          </button>
        )}
        {onGenerateAiRiskClick && (
          <button
            type="button"
            onClick={onGenerateAiRiskClick}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Generate AI Risk
          </button>
        )}
        {onAiReviewClick && (
          <button
            type="button"
            onClick={onAiReviewClick}
            disabled={aiReviewLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            AI Review
          </button>
        )}
        <button
          type="button"
          onClick={() => appendRisks(getRandomDemoRisksToAdd(10))}
          className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          Add x10
        </button>
        <button
          type="button"
          onClick={() => {
            const [risk] = getRandomDemoRisksToAdd(1);
            if (risk) addRisk(risk);
          }}
          className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          Add x1
        </button>
        <button
          type="button"
          onClick={clearRisks}
          className="px-3 py-1.5 text-sm rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          Clear
        </button>
      </div>
    </div>
  );
}