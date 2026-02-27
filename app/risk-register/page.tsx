"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import { selectDecisionByRiskId, selectDecisionScoreDelta } from "@/store/selectors";
import { getForwardSignals } from "@/lib/forwardSignals";
import { RiskRegisterHeader } from "@/components/risk-register/RiskRegisterHeader";
import { RiskExtractPanel } from "@/components/risk-register/RiskExtractPanel";
import { RiskRegisterTable } from "@/components/risk-register/RiskRegisterTable";

const FOCUS_HIGHLIGHT_CLASS = "risk-focus-highlight";
const HIGHLIGHT_DURATION_MS = 2000;

function RiskRegisterContent() {
  const { risks, simulation, riskForecastsById } = useRiskRegister();
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [showProjectedOnly, setShowProjectedOnly] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusRiskId = searchParams.get("focusRiskId");
  const highlightTimeoutRef = useRef<number | null>(null);

  const state = useMemo(() => ({ simulation }), [simulation]);
  const decisionById = useMemo(() => selectDecisionByRiskId(state), [state]);
  const scoreDeltaByRiskId = useMemo(() => selectDecisionScoreDelta(state), [state]);

  const filteredRisks = useMemo(() => {
    const flagged = (r: (typeof risks)[0]) => (decisionById[r.id]?.alertTags?.length ?? 0) > 0;
    const projected = (r: (typeof risks)[0]) => {
      const s = getForwardSignals(r.id, riskForecastsById);
      return s.hasForecast && (s.projectedCritical || s.mitigationInsufficient);
    };
    if (showFlaggedOnly && showProjectedOnly) return risks.filter((r) => flagged(r) || projected(r));
    if (showFlaggedOnly) return risks.filter(flagged);
    if (showProjectedOnly) return risks.filter(projected);
    return risks;
  }, [risks, showFlaggedOnly, showProjectedOnly, decisionById, riskForecastsById]);

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
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, marginBottom: 0, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showFlaggedOnly}
            onChange={(e) => setShowFlaggedOnly(e.target.checked)}
          />
          Show flagged only
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showProjectedOnly}
            onChange={(e) => setShowProjectedOnly(e.target.checked)}
          />
          Show projected only
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