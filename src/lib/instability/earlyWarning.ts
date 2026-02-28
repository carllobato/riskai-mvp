/**
 * Early warning rule: high EII with non-imminent TTC or low confidence.
 * Do NOT mark early warning when TTC <= 21 (imminent breach).
 */

export type EarlyWarningInput = {
  eiiIndex: number;
  timeToCritical: number | null;
  confidence: number; // 0..1
};

export type EarlyWarningResult = {
  earlyWarning: boolean;
  earlyWarningReason: string[];
};

/**
 * Early Warning if:
 * - (EII >= 60 AND (TTC is null OR TTC > 21))
 * OR
 * - (EII >= 50 AND confidence < 0.45)
 * If TTC <= 21 (imminent breach), do NOT mark earlyWarning.
 */
export function computeEarlyWarning(input: EarlyWarningInput): EarlyWarningResult {
  const { eiiIndex, timeToCritical, confidence } = input;
  const reasons: string[] = [];

  if (timeToCritical !== null && timeToCritical <= 21) {
    return { earlyWarning: false, earlyWarningReason: [] };
  }

  const byHighEii = eiiIndex >= 60 && (timeToCritical === null || timeToCritical > 21);
  if (byHighEii) {
    reasons.push("EII ≥ 60 with no imminent breach (TTC > 21 or no critical crossing).");
  }

  const byLowConfidence = eiiIndex >= 50 && confidence < 0.45;
  if (byLowConfidence) {
    reasons.push("EII ≥ 50 with low confidence (< 45%).");
  }

  const earlyWarning = byHighEii || byLowConfidence;
  return { earlyWarning, earlyWarningReason: reasons };
}
