/**
 * Lens IDs (conservative/neutral/aggressive) used by Forward Exposure only.
 * Neutral is the source of truth; lens is an internal overlay for exposure projections.
 * Legacy names (Base, Upside, Downside) map to these three.
 */

export type EngineScenarioId = "conservative" | "neutral" | "aggressive";

/** UI mode: Meeting = neutral-only lens; Diagnostic = lens can be overridden. */
export type UiMode = "Meeting" | "Diagnostic";

/**
 * Returns the active lens ID for Forward Exposure (CaR, sensitivity, concentration).
 * Meeting mode always uses neutral; Diagnostic may use the selected profile as overlay.
 * P-value and simulation outputs are always from neutral and must not use this.
 */
export function getActiveLensId(
  uiMode: UiMode,
  scenarioProfile: string | undefined
): EngineScenarioId {
  if (uiMode === "Meeting") return "neutral";
  return normalizeScenarioId(scenarioProfile);
}

const LEGACY_TO_ENGINE: Record<string, EngineScenarioId> = {
  base: "neutral",
  upside: "conservative",
  downside: "aggressive",
  conservative: "conservative",
  neutral: "neutral",
  aggressive: "aggressive",
};

/**
 * Normalizes any scenario label to engine ID.
 * Legacy: Base, Upside, Downside (case-insensitive) → neutral, conservative, aggressive.
 * Unknown values default to "neutral".
 */
export function normalizeScenarioId(input: string | undefined | null): EngineScenarioId {
  if (input == null || input === "") return "neutral";
  const key = input.trim().toLowerCase();
  return LEGACY_TO_ENGINE[key] ?? "neutral";
}

export const ENGINE_SCENARIO_IDS: readonly EngineScenarioId[] = [
  "conservative",
  "neutral",
  "aggressive",
];
