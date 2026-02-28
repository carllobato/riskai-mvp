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
  const [showEarlyWarningOnly, setShowEarlyWarningOnly] = useState(false);
  const [showCriticalInstabilityOnly, setShowCriticalInstabilityOnly] = useState(false);
  const [sortByInstability, setSortByInstability] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusRiskId = searchParams.get("focusRiskId");
  const highlightTimeoutRef = useRef<number | null>(null);

  const state = useMemo(() => ({ simulation }), [simulation]);
  const decisionById = useMemo(() => selectDecisionByRiskId(state), [state]);
  const scoreDeltaByRiskId = useMemo(() => selectDecisionScoreDelta(state), [state]);

  const earlyWarningCount = useMemo(
    () => risks.filter((r) => riskForecastsById[r.id]?.earlyWarning === true).length,
    [risks, riskForecastsById]
  );

  const filteredRisks = useMemo(() => {
    let list = risks;
    const flagged = (r: (typeof risks)[0]) => (decisionById[r.id]?.alertTags?.length ?? 0) > 0;
    const projected = (r: (typeof risks)[0]) => {
      const s = getForwardSignals(r.id, riskForecastsById);
      return s.hasForecast && (s.projectedCritical || s.mitigationInsufficient);
    };
    const earlyWarning = (r: (typeof risks)[0]) => riskForecastsById[r.id]?.earlyWarning === true;
    const criticalInstability = (r: (typeof risks)[0]) =>
      (riskForecastsById[r.id]?.instability?.index ?? 0) >= 75;
    if (showFlaggedOnly && showProjectedOnly) list = risks.filter((r) => flagged(r) || projected(r));
    else if (showFlaggedOnly) list = risks.filter(flagged);
    else if (showProjectedOnly) list = risks.filter(projected);
    if (showEarlyWarningOnly) list = list.filter(earlyWarning);
    if (showCriticalInstabilityOnly) list = list.filter(criticalInstability);
    if (sortByInstability) {
      list = [...list].sort((a, b) => {
        const ia = riskForecastsById[a.id]?.instability?.index ?? 0;
        const ib = riskForecastsById[b.id]?.instability?.index ?? 0;
        return ib - ia;
      });
    }
    return list;
  }, [
    risks,
    showFlaggedOnly,
    showProjectedOnly,
    showEarlyWarningOnly,
    showCriticalInstabilityOnly,
    sortByInstability,
    decisionById,
    riskForecastsById,
  ]);

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
      {earlyWarningCount > 0 && (
        <button
          type="button"
          onClick={() => setShowEarlyWarningOnly((v) => !v)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 16,
            padding: "10px 12px",
            textAlign: "left",
            fontSize: 13,
            fontWeight: 500,
            color: "#a16207",
            backgroundColor: "rgba(234, 179, 8, 0.1)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            borderRadius: 8,
            cursor: "pointer",
          }}
          title="Click to filter table to early warning risks only"
        >
          {earlyWarningCount} risk{earlyWarningCount === 1 ? "" : "s"} in early warning
          {showEarlyWarningOnly && " (filtered)"}
        </button>
      )}
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
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showEarlyWarningOnly}
            onChange={(e) => setShowEarlyWarningOnly(e.target.checked)}
          />
          Early Warning Only
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showCriticalInstabilityOnly}
            onChange={(e) => setShowCriticalInstabilityOnly(e.target.checked)}
          />
          Critical Instability Only
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={sortByInstability}
            onChange={(e) => setSortByInstability(e.target.checked)}
          />
          Sort by Instability
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