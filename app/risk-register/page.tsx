"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import { selectDecisionByRiskId, selectDecisionScoreDelta } from "@/store/selectors";
import { RiskRegisterHeader } from "@/components/risk-register/RiskRegisterHeader";
import { RiskExtractPanel } from "@/components/risk-register/RiskExtractPanel";
import { RiskRegisterTable } from "@/components/risk-register/RiskRegisterTable";

const FOCUS_HIGHLIGHT_CLASS = "risk-focus-highlight";
const HIGHLIGHT_DURATION_MS = 2000;

function RiskRegisterContent() {
  const { risks, simulation } = useRiskRegister();
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusRiskId = searchParams.get("focusRiskId");
  const highlightTimeoutRef = useRef<number | null>(null);

  const state = useMemo(() => ({ simulation }), [simulation]);
  const decisionById = useMemo(() => selectDecisionByRiskId(state), [state]);
  const scoreDeltaByRiskId = useMemo(() => selectDecisionScoreDelta(state), [state]);
  const filteredRisks = useMemo(
    () =>
      showFlaggedOnly
        ? risks.filter((r) => (decisionById[r.id]?.alertTags?.length ?? 0) > 0)
        : risks,
    [risks, showFlaggedOnly, decisionById]
  );

  useEffect(() => {
    if (!focusRiskId) return;
    const el = document.getElementById(`risk-${focusRiskId}`);
    if (!el) return;

    const delayId = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add(FOCUS_HIGHLIGHT_CLASS);
      highlightTimeoutRef.current = window.setTimeout(() => {
        el.classList.remove(FOCUS_HIGHLIGHT_CLASS);
        highlightTimeoutRef.current = null;
        router.replace("/risk-register", { scroll: false });
      }, HIGHLIGHT_DURATION_MS);
    }, 100);

    return () => {
      clearTimeout(delayId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
      el.classList.remove(FOCUS_HIGHLIGHT_CLASS);
    };
  }, [focusRiskId, router]);

  return (
    <main style={{ padding: 24 }}>
      <RiskRegisterHeader />
      <RiskExtractPanel />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 0 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showFlaggedOnly}
            onChange={(e) => setShowFlaggedOnly(e.target.checked)}
          />
          Show flagged only
        </label>
      </div>
      <RiskRegisterTable risks={filteredRisks} decisionById={decisionById} scoreDeltaByRiskId={scoreDeltaByRiskId} />
    </main>
  );
}

export default function RiskRegisterPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
      <RiskRegisterContent />
    </Suspense>
  );
}