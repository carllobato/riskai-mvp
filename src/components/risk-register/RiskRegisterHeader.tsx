"use client";

import { useRiskRegister } from "@/store/risk-register.store";
import type { ProjectContext } from "@/lib/projectContext";

export type RiskRegisterHeaderProps = {
  projectContext?: ProjectContext | null;
  onAiReviewClick?: () => void;
  aiReviewLoading?: boolean;
  onGenerateAiRiskClick?: () => void;
  onSaveToServer?: () => void | Promise<void>;
  saveToServerLoading?: boolean;
  /** When true, hide mutating actions (viewer / read-only project access). */
  readOnlyContent?: boolean;
};

export function RiskRegisterHeader({
  onAiReviewClick,
  aiReviewLoading = false,
  onGenerateAiRiskClick,
  onSaveToServer,
  saveToServerLoading = false,
  readOnlyContent = false,
}: RiskRegisterHeaderProps) {
  const { clearRisks } = useRiskRegister();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--foreground)] m-0">Risk Register</h2>
        {readOnlyContent && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 m-0" role="status">
            View-only access for this project.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!readOnlyContent && onSaveToServer && (
          <button
            type="button"
            onClick={() => onSaveToServer()}
            disabled={saveToServerLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50 disabled:pointer-events-none"
          >
            {saveToServerLoading ? "Saving…" : "Save"}
          </button>
        )}
        {!readOnlyContent && onGenerateAiRiskClick && (
          <button
            type="button"
            onClick={onGenerateAiRiskClick}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Generate AI Risk
          </button>
        )}
        {!readOnlyContent && onAiReviewClick && (
          <button
            type="button"
            onClick={onAiReviewClick}
            disabled={aiReviewLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            AI Review
          </button>
        )}
        {!readOnlyContent && (
          <button
            type="button"
            onClick={clearRisks}
            className="px-3 py-1.5 text-sm rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}