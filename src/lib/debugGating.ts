/**
 * UI gating: when to show debug blocks (e.g. Forward Exposure debug warnings).
 * Meeting mode = no debug; Diagnostic mode = debug.
 * Used by Outputs page and verified by Engine Health checks.
 */

export type UiMode = "Meeting" | "Diagnostic";

/**
 * Returns true when debug blocks (e.g. debugWarnings, raw curves) should be shown.
 * Meeting: false; Diagnostic: true.
 */
export function shouldShowDebugInOutputs(uiMode: UiMode): boolean {
  return uiMode === "Diagnostic";
}

/**
 * Equivalent to includeDebug for computePortfolioExposure / computeRiskExposureCurve.
 * When false, engine does not return debugWarnings or debug payloads.
 */
export function includeDebugForExposure(uiMode: UiMode): boolean {
  return uiMode === "Diagnostic";
}
