"use client";

import type { Risk } from "@/domain/risk/risk.schema";
import type { DecisionMetrics } from "@/domain/decision/decision.types";
import { RiskRegisterRow } from "@/components/risk-register/RiskRegisterRow";

export function RiskRegisterTable({
  risks,
  decisionById = {},
  scoreDeltaByRiskId = {},
}: {
  risks: Risk[];
  decisionById?: Record<string, DecisionMetrics>;
  scoreDeltaByRiskId?: Record<string, number>;
}) {
  return (
    <div className="mt-4 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-[var(--background)]">
      <div
        className="grid gap-2.5 py-2.5 px-3 font-semibold border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1.5fr 1.5fr 2fr 1fr 1.2fr 0.9fr" }}
      >
        <div>Title</div>
        <div>Category</div>
        <div>Owner</div>
        <div>Inherent</div>
        <div>Residual</div>
        <div className="pt-2.5 mt-1.5 border-t border-neutral-200 dark:border-neutral-700 flex flex-col gap-1 items-start">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            <span className="text-sm" aria-hidden>🛠</span>
            <span>Mitigation Strategy</span>
          </div>
          <div className="text-[11px] font-normal text-neutral-500 dark:text-neutral-500 leading-snug">
            Updates to these fields reset mitigation effectiveness tracking.
          </div>
        </div>
        <div>Status</div>
        <div>Decision</div>
        <div>Instability</div>
      </div>

      {risks.length === 0 ? (
        <div className="p-3 opacity-80 text-[var(--foreground)]">No risks yet.</div>
      ) : (
        risks.map((risk) => (
          <RiskRegisterRow
            key={risk.id}
            risk={risk}
            decision={decisionById[risk.id]}
            scoreDelta={scoreDeltaByRiskId[risk.id]}
          />
        ))
      )}
    </div>
  );
}