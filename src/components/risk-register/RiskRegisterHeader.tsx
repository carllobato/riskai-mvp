"use client";

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
  readOnlyContent = false,
}: RiskRegisterHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      {readOnlyContent ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0" role="status">
          View-only access for this project.
        </p>
      ) : null}
    </div>
  );
}