/**
 * Dev-only safeguard: check scenario ordering and neutral baseline consistency.
 * Does not block rendering; logs console.warn and returns flag on violation.
 */

export type ScenarioTTCSnapshot = {
  conservativeTTC: number | null;
  neutralTTC: number | null;
  aggressiveTTC: number | null;
};

/** Treat null as "never in horizon" = large value for ordering. */
const NULL_AS_VALUE = 90;

function toComparable(t: number | null): number {
  return t ?? NULL_AS_VALUE;
}

/**
 * Scenario ordering: conservative (fades sooner) should reach critical later or never;
 * aggressive (persists longer) should reach critical sooner.
 * So we expect: conservativeTTC >= neutralTTC >= aggressiveTTC.
 */
function isOrderingConsistent(snap: ScenarioTTCSnapshot): boolean {
  const c = toComparable(snap.conservativeTTC);
  const n = toComparable(snap.neutralTTC);
  const a = toComparable(snap.aggressiveTTC);
  return c >= n && n >= a;
}

/**
 * Neutral should equal baseline when profile is neutral (same engine run).
 * Here we only have scenario TTCs; "baseline" is the neutral run, so neutral TTC
 * is the baseline. Consistency check: neutral is between conservative and aggressive.
 */
function isNeutralBetweenExtremes(snap: ScenarioTTCSnapshot): boolean {
  const c = toComparable(snap.conservativeTTC);
  const n = toComparable(snap.neutralTTC);
  const a = toComparable(snap.aggressiveTTC);
  const min = Math.min(c, a);
  const max = Math.max(c, a);
  return n >= min && n <= max;
}

export type ValidateScenarioOrderingResult = {
  valid: boolean;
  flag?: "ScenarioOrderingViolation";
};

/**
 * Validates scenario ordering for all given snapshots.
 * In dev mode, logs console.warn on violation and returns flag.
 * Does not throw; does not block rendering.
 */
export function validateScenarioOrdering(
  snapshots: ScenarioTTCSnapshot[]
): ValidateScenarioOrderingResult {
  let valid = true;
  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i]!;
    if (!isOrderingConsistent(snap) || !isNeutralBetweenExtremes(snap)) {
      valid = false;
      if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
        console.warn(
          "[validateScenarioOrdering] Scenario ordering or neutral consistency violation at index",
          i,
          { conservativeTTC: snap.conservativeTTC, neutralTTC: snap.neutralTTC, aggressiveTTC: snap.aggressiveTTC }
        );
      }
    }
  }
  if (!valid) {
    return { valid: false, flag: "ScenarioOrderingViolation" };
  }
  return { valid: true };
}
