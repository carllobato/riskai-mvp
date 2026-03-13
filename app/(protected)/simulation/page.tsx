"use client";

import { RedirectToProjectRoute } from "../RedirectToProjectRoute";

/**
 * Legacy route: redirects to /projects/[activeId]/simulation or / for coherent MVP URL structure.
 */
export default function SimulationLegacyRedirectPage() {
  return <RedirectToProjectRoute slug="simulation" />;
}
