/**
 * Day 11 A4: Scenario lens selection (Manual vs Auto).
 * Display-layer only; does not change projection engine.
 */

export type ScenarioLensMode = "Manual" | "Auto";

export type ScenarioName = "Conservative" | "Neutral" | "Aggressive";

export const AUTO_SCENARIO_FALLBACK: ScenarioName = "Neutral";

export type RiskWithInstability = {
  instability?: { recommendedScenario: ScenarioName } | null;
};

/**
 * Returns the scenario to use for display for a given risk.
 * - Manual: return manualScenario.
 * - Auto: return risk.instability?.recommendedScenario ?? AUTO_SCENARIO_FALLBACK.
 * Do NOT store scenario per risk; compute on render.
 */
export function selectScenarioForRisk<R extends RiskWithInstability>(
  risk: R,
  lensMode: ScenarioLensMode,
  manualScenario: ScenarioName
): ScenarioName {
  if (lensMode === "Manual") return manualScenario;
  if (risk.instability?.recommendedScenario) return risk.instability.recommendedScenario;
  return AUTO_SCENARIO_FALLBACK;
}

const SCENARIO_TO_KEY: Record<ScenarioName, "conservative" | "neutral" | "aggressive"> = {
  Conservative: "conservative",
  Neutral: "neutral",
  Aggressive: "aggressive",
};

export type ScenarioTTCMap = {
  conservative: number | null;
  neutral: number | null;
  aggressive: number | null;
};

/**
 * Returns TTC for the given scenario from forecast.scenarioTTC.
 * If scenarioTTC or the scenario key is missing, returns null and fallbackNeutral should be used.
 */
export function getTTCForScenario(
  scenarioTTC: ScenarioTTCMap | undefined,
  scenarioName: ScenarioName
): { ttc: number | null; fallbackToNeutral: boolean } {
  if (!scenarioTTC) return { ttc: null, fallbackToNeutral: true };
  const key = SCENARIO_TO_KEY[scenarioName];
  const ttc = scenarioTTC[key];
  if (ttc === undefined) return { ttc: null, fallbackToNeutral: true };
  return { ttc, fallbackToNeutral: false };
}

/** Map ProjectionProfile (engine) to ScenarioName (display). */
export function profileToScenarioName(
  profile: "conservative" | "neutral" | "aggressive"
): ScenarioName {
  return profile === "conservative"
    ? "Conservative"
    : profile === "aggressive"
      ? "Aggressive"
      : "Neutral";
}

/** Map ScenarioName to ProjectionProfile. */
export function scenarioNameToProfile(
  name: ScenarioName
): "conservative" | "neutral" | "aggressive" {
  return name === "Conservative" ? "conservative" : name === "Aggressive" ? "aggressive" : "neutral";
}
