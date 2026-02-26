"use client";

import { useRiskRegister } from "@/store/risk-register.store";
import { RiskRegisterHeader } from "@/components/risk-register/RiskRegisterHeader";
import { RiskExtractPanel } from "@/components/risk-register/RiskExtractPanel";
import { RiskRegisterTable } from "@/components/risk-register/RiskRegisterTable";

export default function RiskRegisterPage() {
  const { risks } = useRiskRegister();

  return (
    <main style={{ padding: 24 }}>
      <RiskRegisterHeader />
      <RiskExtractPanel />
      <RiskRegisterTable risks={risks} />
    </main>
  );
}