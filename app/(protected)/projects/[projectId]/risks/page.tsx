"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RiskRegisterContent } from "../../../risk-register/page";

export default function ProjectRisksPage() {
  const params = useParams();
  const projectId = typeof params?.projectId === "string" ? params.projectId : null;

  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
      <RiskRegisterContent projectId={projectId} />
    </Suspense>
  );
}
