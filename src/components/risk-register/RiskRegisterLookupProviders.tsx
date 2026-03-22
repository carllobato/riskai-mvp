"use client";

import type { ReactNode } from "react";
import { RiskAppliesToOptionsProvider } from "./RiskAppliesToOptionsContext";
import { RiskCategoryOptionsProvider } from "./RiskCategoryOptionsContext";
import { RiskProjectOwnersProvider } from "./RiskProjectOwnersContext";
import { RiskStatusOptionsProvider } from "./RiskStatusOptionsContext";

/** Wraps risk-register screens so category / status / applies_to / project owners lookups are available. */
export function RiskRegisterLookupProviders({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  return (
    <RiskCategoryOptionsProvider>
      <RiskStatusOptionsProvider>
        <RiskAppliesToOptionsProvider>
          <RiskProjectOwnersProvider projectId={projectId}>{children}</RiskProjectOwnersProvider>
        </RiskAppliesToOptionsProvider>
      </RiskStatusOptionsProvider>
    </RiskCategoryOptionsProvider>
  );
}
