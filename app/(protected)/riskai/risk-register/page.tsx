"use client";

import { RedirectToProjectRoute } from "../RedirectToProjectRoute";

/**
 * Legacy route: redirects to /projects/[activeId]/risks or / for coherent MVP URL structure.
 */
export default function RiskRegisterLegacyRedirectPage() {
  return <RedirectToProjectRoute slug="risks" />;
}
