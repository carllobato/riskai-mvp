/**
 * Dev-only fixtures for Engine Health checks.
 * Deterministic baseline and edge-case risks — same every run.
 */

import type { Risk, RiskCategory } from "@/domain/risk/risk.schema";
import { createRisk } from "@/domain/risk/risk.factory";
import { buildRating } from "@/domain/risk/risk.logic";

const NOW = "2025-01-15T12:00:00.000Z";

function r(partial: Parameters<typeof createRisk>[0]): Risk {
  const risk = createRisk(partial);
  return { ...risk, createdAt: NOW, updatedAt: NOW };
}

/**
 * ~10 realistic risks with varied probability, impact, persistence, sensitivity,
 * timeProfile, and mitigation. Used for invariant checks (no hard-coded numbers).
 */
export const baselineRisks: Risk[] = [
  r({
    id: "base-1",
    title: "Supply chain — long lead",
    category: "commercial" as RiskCategory,
    baseCostImpact: 380_000,
    probability: 0.65,
    escalationPersistence: 0.7,
    sensitivity: 0.6,
    timeProfile: "front",
    mitigationProfile: { status: "active", effectiveness: 0.7, confidence: 0.75, reduces: 0.5, lagMonths: 3 },
    inherentRating: buildRating(4, 4),
    residualRating: buildRating(3, 3),
  }),
  r({
    id: "base-2",
    title: "Design interface freeze",
    category: "design" as RiskCategory,
    baseCostImpact: 45_000,
    probability: 0.35,
    escalationPersistence: 0.4,
    sensitivity: 0.5,
    timeProfile: "mid",
    mitigationProfile: { status: "none", effectiveness: 0, confidence: 0, reduces: 0, lagMonths: 0 },
    inherentRating: buildRating(2, 3),
    residualRating: buildRating(2, 3),
  }),
  r({
    id: "base-3",
    title: "Labour availability",
    category: "construction" as RiskCategory,
    baseCostImpact: 120_000,
    probability: 0.55,
    escalationPersistence: 0.8,
    sensitivity: 0.7,
    timeProfile: "back",
    mitigationProfile: { status: "planned", effectiveness: 0.5, confidence: 0.6, reduces: 0.4, lagMonths: 6 },
    inherentRating: buildRating(3, 4),
    residualRating: buildRating(3, 4),
  }),
  r({
    id: "base-4",
    title: "Planning consent delay",
    category: "authority" as RiskCategory,
    baseCostImpact: 280_000,
    probability: 0.5,
    escalationPersistence: 0.6,
    sensitivity: 0.8,
    timeProfile: "front",
    mitigationProfile: { status: "active", effectiveness: 0.6, confidence: 0.65, reduces: 0.45, lagMonths: 2 },
    inherentRating: buildRating(4, 4),
    residualRating: buildRating(3, 3),
  }),
  r({
    id: "base-5",
    title: "Bulk materials escalation",
    category: "procurement" as RiskCategory,
    baseCostImpact: 95_000,
    probability: 0.7,
    escalationPersistence: 0.5,
    sensitivity: 0.75,
    timeProfile: "mid",
    mitigationProfile: { status: "completed", effectiveness: 0.8, confidence: 0.85, reduces: 0.6, lagMonths: 1 },
    inherentRating: buildRating(4, 3),
    residualRating: buildRating(2, 2),
  }),
  r({
    id: "base-6",
    title: "HSE contractor compliance",
    category: "hse" as RiskCategory,
    baseCostImpact: 22_000,
    probability: 0.2,
    escalationPersistence: 0.3,
    sensitivity: 0.4,
    timeProfile: [1, 1, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0], // custom weights
    mitigationProfile: { status: "active", effectiveness: 0.75, confidence: 0.8, reduces: 0.55, lagMonths: 4 },
    inherentRating: buildRating(2, 2),
    residualRating: buildRating(2, 2),
  }),
  r({
    id: "base-7",
    title: "Critical path float",
    category: "programme" as RiskCategory,
    baseCostImpact: 180_000,
    probability: 0.6,
    escalationPersistence: 0.65,
    sensitivity: 0.65,
    timeProfile: "back",
    mitigationProfile: { status: "planned", effectiveness: 0.4, confidence: 0.5, reduces: 0.35, lagMonths: 8 },
    inherentRating: buildRating(4, 4),
    residualRating: buildRating(4, 4),
  }),
  r({
    id: "base-8",
    title: "Handover documentation",
    category: "operations" as RiskCategory,
    baseCostImpact: 55_000,
    probability: 0.4,
    escalationPersistence: 0.45,
    sensitivity: 0.5,
    timeProfile: "front",
    mitigationProfile: { status: "active", effectiveness: 0.65, confidence: 0.7, reduces: 0.5, lagMonths: 5 },
    inherentRating: buildRating(3, 3),
    residualRating: buildRating(3, 3),
  }),
  r({
    id: "base-9",
    title: "Subcontractor default",
    category: "commercial" as RiskCategory,
    baseCostImpact: 420_000,
    probability: 0.25,
    escalationPersistence: 0.85,
    sensitivity: 0.9,
    timeProfile: "back",
    mitigationProfile: { status: "none", effectiveness: 0, confidence: 0, reduces: 0, lagMonths: 0 },
    inherentRating: buildRating(2, 5),
    residualRating: buildRating(2, 5),
  }),
  r({
    id: "base-10",
    title: "Design late changes",
    category: "design" as RiskCategory,
    baseCostImpact: 75_000,
    probability: 0.5,
    escalationPersistence: 0.55,
    sensitivity: 0.6,
    timeProfile: "mid",
    mitigationProfile: { status: "completed", effectiveness: 0.85, confidence: 0.8, reduces: 0.65, lagMonths: 0 },
    inherentRating: buildRating(3, 3),
    residualRating: buildRating(2, 2),
  }),
];

/**
 * Edge-case risks: missing fields, out-of-range values, negatives, etc.
 * Used to assert engine sanitizes and does not throw or produce NaN/Infinity.
 */
export const edgeRisks: Risk[] = (() => {
  const base = r({
    id: "edge-1",
    title: "Minimal valid",
    category: "other" as RiskCategory,
    inherentRating: buildRating(1, 1),
    residualRating: buildRating(1, 1),
  });

  const withMissingFields = r({
    id: "edge-2",
    title: "Missing optional",
    category: "other" as RiskCategory,
    baseCostImpact: 50_000,
    probability: 0.5,
    inherentRating: buildRating(2, 2),
    residualRating: buildRating(2, 2),
  });

  const negativeImpact = {
    ...r({
      id: "edge-3",
      title: "Negative impact",
      category: "other" as RiskCategory,
      baseCostImpact: -10_000,
      probability: 0.3,
      inherentRating: buildRating(2, 2),
      residualRating: buildRating(2, 2),
    }),
    baseCostImpact: -10_000,
  } as Risk;

  const probOverOne = {
    ...r({
      id: "edge-4",
      title: "Probability > 1",
      category: "other" as RiskCategory,
      probability: 1.5,
      baseCostImpact: 100_000,
      inherentRating: buildRating(3, 3),
      residualRating: buildRating(3, 3),
    }),
    probability: 1.5,
  } as Risk;

  const zeroWeights = r({
    id: "edge-5",
    title: "Zero time weights",
    category: "other" as RiskCategory,
    timeProfile: [0, 0, 0, 0],
    baseCostImpact: 100_000,
    probability: 0.5,
    inherentRating: buildRating(2, 2),
    residualRating: buildRating(2, 2),
  });

  const missingMitigation = { ...r({
    id: "edge-6",
    title: "No mitigation profile",
    category: "other" as RiskCategory,
    baseCostImpact: 80_000,
    probability: 0.4,
    inherentRating: buildRating(2, 2),
    residualRating: buildRating(2, 2),
  }) };
  (missingMitigation as Record<string, unknown>).mitigationProfile = undefined;

  const missingPersistence = {
    ...r({
      id: "edge-7",
      title: "Missing escalationPersistence",
      category: "other" as RiskCategory,
      baseCostImpact: 60_000,
      probability: 0.5,
      inherentRating: buildRating(2, 2),
      residualRating: buildRating(2, 2),
    }),
    escalationPersistence: undefined,
  } as Risk;

  const extremelyHighValues = {
    ...r({
      id: "edge-8",
      title: "Extremely high impact",
      category: "other" as RiskCategory,
      baseCostImpact: 1e12,
      probability: 1,
      inherentRating: buildRating(5, 5),
      residualRating: buildRating(5, 5),
    }),
    baseCostImpact: 1e12,
    probability: 1,
  } as Risk;

  return [
    base,
    withMissingFields,
    negativeImpact,
    probOverOne,
    zeroWeights,
    missingMitigation as Risk,
    missingPersistence,
    extremelyHighValues,
  ];
})();

/** Mitigation off for lens-isolation checks (Lens Range Integrity, Envelope Consistency). */
const NO_MITIGATION = { status: "none" as const, effectiveness: 0, confidence: 0, reduces: 0, lagMonths: 0 };

/**
 * Small deterministic set for Lens Range Integrity: lens must affect exposure.
 * - At least 3 risks
 * - At least one with sensitivity > 0.6
 * - probability and baseCostImpact non-zero
 * - mitigation off (to isolate lens)
 */
export const lensIntegrityRisks: Risk[] = [
  r({
    id: "lens-1",
    title: "Lens test A",
    category: "commercial" as RiskCategory,
    baseCostImpact: 100_000,
    probability: 0.5,
    escalationPersistence: 0.5,
    sensitivity: 0.4,
    timeProfile: "mid",
    mitigationProfile: NO_MITIGATION,
    inherentRating: buildRating(3, 3),
    residualRating: buildRating(3, 3),
  }),
  r({
    id: "lens-2",
    title: "Lens test B (high sensitivity)",
    category: "design" as RiskCategory,
    baseCostImpact: 80_000,
    probability: 0.6,
    escalationPersistence: 0.6,
    sensitivity: 0.75,
    timeProfile: "front",
    mitigationProfile: NO_MITIGATION,
    inherentRating: buildRating(3, 3),
    residualRating: buildRating(3, 3),
  }),
  r({
    id: "lens-3",
    title: "Lens test C",
    category: "construction" as RiskCategory,
    baseCostImpact: 60_000,
    probability: 0.4,
    escalationPersistence: 0.5,
    sensitivity: 0.5,
    timeProfile: "back",
    mitigationProfile: NO_MITIGATION,
    inherentRating: buildRating(2, 2),
    residualRating: buildRating(2, 2),
  }),
];
