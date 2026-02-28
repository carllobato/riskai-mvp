/**
 * Demo/seed risk data for Forward Capital Intelligence.
 * At least 10 risks with mix of mitigation statuses, lags, persistence, sensitivity, and impacts.
 */

import type { Risk, RiskCategory } from "@/domain/risk/risk.schema";
import { createRisk } from "@/domain/risk/risk.factory";
import { buildRating } from "@/domain/risk/risk.logic";

const NOW = new Date().toISOString();

function demoRisk(partial: Parameters<typeof createRisk>[0]): Risk {
  const r = createRisk(partial);
  return { ...r, createdAt: NOW, updatedAt: NOW };
}

/**
 * Returns 12 demo risks with varied forward-exposure attributes so that
 * Base/Downside charts and top drivers are non-trivial.
 */
export function getDemoRisks(): Risk[] {
  return [
    demoRisk({
      id: "demo-1",
      title: "Long lead switchgear — supply chain",
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
    demoRisk({
      id: "demo-2",
      title: "Design change — interface freeze",
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
    demoRisk({
      id: "demo-3",
      title: "Labour availability — specialist skills",
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
    demoRisk({
      id: "demo-4",
      title: "Authority consent — planning delay",
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
    demoRisk({
      id: "demo-5",
      title: "Bulk materials — price escalation",
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
    demoRisk({
      id: "demo-6",
      title: "HSE incident — contractor compliance",
      category: "hse" as RiskCategory,
      baseCostImpact: 22_000,
      probability: 0.2,
      escalationPersistence: 0.3,
      sensitivity: 0.4,
      timeProfile: "mid",
      mitigationProfile: { status: "active", effectiveness: 0.75, confidence: 0.8, reduces: 0.55, lagMonths: 4 },
      inherentRating: buildRating(2, 2),
      residualRating: buildRating(2, 2),
    }),
    demoRisk({
      id: "demo-7",
      title: "Programme float — critical path",
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
    demoRisk({
      id: "demo-8",
      title: "Operations handover — documentation",
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
    demoRisk({
      id: "demo-9",
      title: "Subcontractor default — tier two",
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
    demoRisk({
      id: "demo-10",
      title: "Design maturity — late changes",
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
    demoRisk({
      id: "demo-11",
      title: "Weather — seasonal delay",
      category: "construction" as RiskCategory,
      baseCostImpact: 65_000,
      probability: 0.45,
      escalationPersistence: 0.35,
      sensitivity: 0.55,
      timeProfile: "front",
      mitigationProfile: { status: "planned", effectiveness: 0.55, confidence: 0.6, reduces: 0.4, lagMonths: 12 },
      inherentRating: buildRating(3, 3),
      residualRating: buildRating(3, 3),
    }),
    demoRisk({
      id: "demo-12",
      title: "FX exposure — unhedged portion",
      category: "commercial" as RiskCategory,
      baseCostImpact: 150_000,
      probability: 0.55,
      escalationPersistence: 0.6,
      sensitivity: 0.85,
      timeProfile: "back",
      mitigationProfile: { status: "active", effectiveness: 0.5, confidence: 0.55, reduces: 0.35, lagMonths: 2 },
      inherentRating: buildRating(3, 4),
      residualRating: buildRating(3, 3),
    }),
  ];
}
