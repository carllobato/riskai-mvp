/**
 * UI gating: when to show debug blocks (e.g. Forward Exposure debug warnings).
 * MVP mode = no debug; Debug mode = debug.
 * Used by Outputs page and verified by Engine Health checks.
 */

export type UiMode = "MVP" | "Debug";

/**
 * Returns true when debug blocks (e.g. debugWarnings, raw curves) should be shown.
 * MVP: false; Debug: true.
 */
export function shouldShowDebugInOutputs(uiMode: UiMode): boolean {
  return uiMode === "Debug";
}

/**
 * Equivalent to includeDebug for computePortfolioExposure / computeRiskExposureCurve.
 * When false, engine does not return debugWarnings or debug payloads.
 */
export function includeDebugForExposure(uiMode: UiMode): boolean {
  return uiMode === "Debug";
}
