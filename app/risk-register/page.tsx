"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import { RiskRegisterHeader } from "@/components/risk-register/RiskRegisterHeader";
import { RiskExtractPanel } from "@/components/risk-register/RiskExtractPanel";
import { RiskRegisterTable } from "@/components/risk-register/RiskRegisterTable";

const FOCUS_HIGHLIGHT_CLASS = "risk-focus-highlight";
const HIGHLIGHT_DURATION_MS = 2000;

export default function RiskRegisterPage() {
  const { risks } = useRiskRegister();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusRiskId = searchParams.get("focusRiskId");
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      <RiskRegisterTable risks={risks} />
    </main>
  );
}