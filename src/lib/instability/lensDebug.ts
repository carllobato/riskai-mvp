/**
 * Lightweight debug helper for lens selection (Auto/Manual).
 * Dev-only; used by LensDebugIcon.
 */

import { selectScenarioForRisk } from "@/lib/instability/selectScenarioLens";
import type { ScenarioLensMode, ScenarioName } from "@/lib/instability/selectScenarioLens";
import type { RiskWithInstability } from "@/lib/instability/selectScenarioLens";

export type LensDebugResult = {
  scenarioToUse: ScenarioName;
  differsFromManual: boolean;
  isAuto: boolean;
};

/**
 * Returns debug info for the current lens selection for a risk.
 * - scenarioToUse: result of selectScenarioForRisk(risk, lensMode, manualScenario)
 * - differsFromManual: scenarioToUse !== manualScenario
 * - isAuto: lensMode === "Auto"
 */
export function getLensDebug(
  risk: RiskWithInstability,
  lensMode: ScenarioLensMode,
  manualScenario: ScenarioName
): LensDebugResult {
  const scenarioToUse = selectScenarioForRisk(risk, lensMode, manualScenario);
  return {
    scenarioToUse,
    differsFromManual: scenarioToUse !== manualScenario,
    isAuto: lensMode === "Auto",
  };
}
