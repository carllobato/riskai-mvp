import type {
  SimulationDelta,
  SimulationRiskDelta,
  SimulationRiskSnapshot,
  SimulationSnapshot,
} from "@/domain/simulation/simulation.types";

const FLAT_THRESHOLD_PCT = 0.05;

/** Safe percentage: (curr - prev) / prev, or 0 when prev is 0. */
function safePct(delta: number, prev: number): number {
  if (prev === 0) return 0;
  return delta / prev;
}

/**
 * Compute delta between two simulation snapshots. Matches risks by id.
 * Direction is "flat" when abs(deltaCostPct) < 5%.
 */
export function calculateDelta(
  previous: SimulationSnapshot,
  current: SimulationSnapshot
): SimulationDelta {
  const prevById = new Map<string, SimulationRiskSnapshot>(
    previous.risks.map((r) => [r.id, r])
  );

  const portfolioDeltaCost = current.totalExpectedCost - previous.totalExpectedCost;
  const portfolioDeltaCostPct = safePct(portfolioDeltaCost, previous.totalExpectedCost);
  const portfolioDeltaDays = current.totalExpectedDays - previous.totalExpectedDays;
  const portfolioDeltaDaysPct = safePct(portfolioDeltaDays, previous.totalExpectedDays);

  const riskDeltas: SimulationRiskDelta[] = current.risks.map((curr) => {
    const prev = prevById.get(curr.id);
    const prevSimMeanCost = prev != null ? (prev.simMeanCost ?? prev.expectedCost) : 0;
    const currSimMeanCost = curr.simMeanCost ?? curr.expectedCost;
    const deltaCost = currSimMeanCost - prevSimMeanCost;
    const deltaCostPct = safePct(deltaCost, prevSimMeanCost);
    const prevDays = prev?.expectedDays ?? 0;
    const deltaDays = curr.expectedDays - prevDays;
    const deltaDaysPct = safePct(deltaDays, prevDays);
    const direction: "up" | "down" | "flat" =
      Math.abs(deltaCostPct) < FLAT_THRESHOLD_PCT ? "flat" : deltaCost > 0 ? "up" : "down";

    return {
      id: curr.id,
      title: curr.title,
      category: curr.category,
      prevExpectedCost: prevSimMeanCost,
      currExpectedCost: currSimMeanCost,
      deltaCost,
      deltaCostPct,
      prevExpectedDays: prevDays,
      currExpectedDays: curr.expectedDays,
      deltaDays,
      deltaDaysPct,
      direction,
    };
  });

  return {
    portfolioDeltaCost,
    portfolioDeltaCostPct,
    portfolioDeltaDays,
    portfolioDeltaDaysPct,
    riskDeltas,
  };
}
