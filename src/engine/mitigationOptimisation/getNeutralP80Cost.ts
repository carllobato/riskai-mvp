import type { SimulationSnapshot } from "@/domain/simulation/simulation.types";

/**
 * Reads P80 cost from the neutral snapshot. Mirrors Outputs page usage: snapshot.p80Cost.
 * @throws Error if snapshot or p80Cost is missing (lists checked paths).
 */
export function getNeutralP80Cost(neutralSnapshot: SimulationSnapshot): number {
  if (neutralSnapshot == null || typeof neutralSnapshot !== "object") {
    throw new Error(
      "MitigationOptimisation: neutral snapshot missing or invalid. Checked: neutralSnapshot (required object)."
    );
  }
  const p80 = neutralSnapshot.p80Cost;
  if (typeof p80 !== "number" || !Number.isFinite(p80)) {
    throw new Error(
      "MitigationOptimisation: neutral snapshot has no P80 cost. Checked: neutralSnapshot.p80Cost (expected finite number)."
    );
  }
  return p80;
}
