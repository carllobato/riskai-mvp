"use client";

import { createPortal } from "react-dom";
import { RiskExtractPanel } from "@/components/risk-register/RiskExtractPanel";

const btnSecondary =
  "px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 shrink-0";

export function CreateRiskAIModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/75 dark:bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-risk-ai-dialog-title"
      onClick={handleBackdropClick}
    >
      <div
        style={{ width: "90vw", maxWidth: 560, maxHeight: "90vh" }}
        className="shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 shrink-0 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 py-3">
          <h2 id="create-risk-ai-dialog-title" className="text-lg font-semibold text-[var(--foreground)]">
            Create Risk with AI
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md border border-transparent text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Describe your risk including mitigation, cost and time data. AI will extract structured risk fields.
          </p>
          <RiskExtractPanel hideTitle showStatus />
        </div>
        <div className="flex justify-end gap-2 shrink-0 px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
