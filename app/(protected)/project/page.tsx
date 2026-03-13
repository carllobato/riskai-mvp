"use client";

import { RedirectToProjectRoute } from "../RedirectToProjectRoute";

/**
 * Legacy route: redirects to /projects/[activeId]/setup or / for coherent MVP URL structure.
 */
export default function ProjectLegacyRedirectPage() {
  return <RedirectToProjectRoute slug="setup" />;
}
