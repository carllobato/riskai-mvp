/**
 * Demo/seed risk data with all required fields completed.
 * Used by Add x10 / Add x1: preloads risks from a pool of 100 (10 templates × 10).
 * Mix of risks with mitigation (status "mitigating") and without (status "open").
 */

import type { Risk, RiskCategory } from "@/domain/risk/risk.schema";
import { createRisk } from "@/domain/risk/risk.factory";
import { buildRating } from "@/domain/risk/risk.logic";
import { makeId } from "@/lib/id";

const NOW = new Date().toISOString();

/** Keys that must be present for form validation (pre/post cost and time min, ML, max). */
function pickPrePostFromPartial(partial: {
  preMitigationProbabilityPct?: number;
  preMitigationCostMin?: number;
  preMitigationCostML?: number;
  preMitigationCostMax?: number;
  preMitigationTimeMin?: number;
  preMitigationTimeML?: number;
  preMitigationTimeMax?: number;
  postMitigationProbabilityPct?: number;
  postMitigationCostMin?: number;
  postMitigationCostML?: number;
  postMitigationCostMax?: number;
  postMitigationTimeMin?: number;
  postMitigationTimeML?: number;
  postMitigationTimeMax?: number;
}) {
  const pre = {
    preMitigationProbabilityPct: partial.preMitigationProbabilityPct,
    preMitigationCostMin: partial.preMitigationCostMin,
    preMitigationCostML: partial.preMitigationCostML,
    preMitigationCostMax: partial.preMitigationCostMax,
    preMitigationTimeMin: partial.preMitigationTimeMin,
    preMitigationTimeML: partial.preMitigationTimeML,
    preMitigationTimeMax: partial.preMitigationTimeMax,
  };
  const post = {
    postMitigationProbabilityPct: partial.postMitigationProbabilityPct,
    postMitigationCostMin: partial.postMitigationCostMin,
    postMitigationCostML: partial.postMitigationCostML,
    postMitigationCostMax: partial.postMitigationCostMax,
    postMitigationTimeMin: partial.postMitigationTimeMin,
    postMitigationTimeML: partial.postMitigationTimeML,
    postMitigationTimeMax: partial.postMitigationTimeMax,
  };
  return { ...pre, ...post };
}

function demoRisk(partial: Parameters<typeof createRisk>[0]): Risk {
  const r = createRisk(partial);
  const prePost = pickPrePostFromPartial(partial as Parameters<typeof pickPrePostFromPartial>[0]);
  return { ...r, ...prePost, createdAt: NOW, updatedAt: NOW };
}

/** Full pre-mitigation fields for appliesTo "both" (cost + time). */
function preBoth(prePct: number, costMin: number, costML: number, costMax: number, timeMin: number, timeML: number, timeMax: number) {
  return {
    preMitigationProbabilityPct: prePct,
    preMitigationCostMin: costMin,
    preMitigationCostML: costML,
    preMitigationCostMax: costMax,
    preMitigationTimeMin: timeMin,
    preMitigationTimeML: timeML,
    preMitigationTimeMax: timeMax,
    appliesTo: "both" as const,
  };
}

/** Post-mitigation fields when mitigation is applied. */
function postBoth(postPct: number, costMin: number, costML: number, costMax: number, timeMin: number, timeML: number, timeMax: number) {
  return {
    postMitigationProbabilityPct: postPct,
    postMitigationCostMin: costMin,
    postMitigationCostML: costML,
    postMitigationCostMax: costMax,
    postMitigationTimeMin: timeMin,
    postMitigationTimeML: timeML,
    postMitigationTimeMax: timeMax,
  };
}

/**
 * Returns 10 demo risk templates with all required fields completed.
 * Required: title, description, category, status, owner, appliesTo, pre cost/time, inherentRating, residualRating, baseCostImpact, costImpact, scheduleImpactDays, probability.
 * With mitigation: mitigation text, mitigationCost (optional), and full post-mitigation cost/time/probability.
 * Without mitigation: no mitigation/post fields (UI shows N/A).
 */
export function getDemoRisks(): Risk[] {
  return [
    // --- With mitigation ---
    demoRisk({
      id: "demo-1",
      riskNumber: 1,
      title: "Long lead switchgear — supply chain",
      description: "Critical switchgear has extended lead times from a single preferred supplier. Delays could push substation commissioning and impact programme.",
      category: "commercial" as RiskCategory,
      status: "open",
      owner: "Project Manager",
      ...preBoth(65, 200_000, 380_000, 600_000, 14, 45, 90),
      mitigation: "Early engagement with supplier; dual-source evaluation; place advance order with penalty clauses.",
      mitigationCost: 15_000,
      ...postBoth(40, 80_000, 180_000, 320_000, 7, 20, 45),
      inherentRating: buildRating(4, 4),
      residualRating: buildRating(3, 3),
      baseCostImpact: 380_000,
      costImpact: 180_000,
      scheduleImpactDays: 20,
      probability: 0.4,
    }),
    // --- No mitigation (no mitigation text, no post-mitigation fields) ---
    demoRisk({
      id: "demo-2",
      riskNumber: 2,
      title: "Design change — interface freeze",
      description: "Late design changes to interface specifications could trigger rework across packages and delay handover.",
      category: "design" as RiskCategory,
      status: "open",
      owner: "Risk Owner",
      ...preBoth(35, 20_000, 45_000, 80_000, 7, 21, 45),
      mitigation: "",
      inherentRating: buildRating(2, 3),
      residualRating: buildRating(2, 3),
      baseCostImpact: 45_000,
      costImpact: 45_000,
      scheduleImpactDays: 21,
      probability: 0.35,
    }),
    // --- With mitigation ---
    demoRisk({
      id: "demo-3",
      riskNumber: 3,
      title: "Labour availability — specialist skills",
      description: "Shortage of qualified electrical and commissioning engineers could delay completion and increase cost through overtime or external labour.",
      category: "construction" as RiskCategory,
      status: "monitoring",
      owner: "Engineering",
      ...preBoth(55, 60_000, 120_000, 200_000, 14, 30, 60),
      mitigation: "Framework agreements with specialist agencies; upskilling programme; phased recruitment.",
      mitigationCost: 8_000,
      ...postBoth(35, 30_000, 75_000, 130_000, 7, 18, 40),
      inherentRating: buildRating(3, 4),
      residualRating: buildRating(3, 3),
      baseCostImpact: 120_000,
      costImpact: 75_000,
      scheduleImpactDays: 18,
      probability: 0.35,
    }),
    demoRisk({
      id: "demo-4",
      riskNumber: 4,
      title: "Authority consent — planning delay",
      description: "Conditional discharge or late planning variations could hold up construction and cause programme slip.",
      category: "authority" as RiskCategory,
      status: "mitigating",
      owner: "Project Manager",
      ...preBoth(50, 150_000, 280_000, 450_000, 30, 60, 120),
      mitigation: "Pre-application advice; early submission; dedicated planning lead and weekly liaison.",
      mitigationCost: 12_000,
      ...postBoth(30, 50_000, 140_000, 250_000, 14, 35, 70),
      inherentRating: buildRating(4, 4),
      residualRating: buildRating(3, 3),
      baseCostImpact: 280_000,
      costImpact: 140_000,
      scheduleImpactDays: 35,
      probability: 0.3,
    }),
    // --- No mitigation (no mitigation text, no post-mitigation fields) ---
    demoRisk({
      id: "demo-5",
      riskNumber: 5,
      title: "Bulk materials — price escalation",
      description: "Steel, copper and cable prices remain volatile; exposure on unfixed packages could increase outturn cost.",
      category: "procurement" as RiskCategory,
      status: "open",
      owner: "Procurement",
      ...preBoth(70, 50_000, 95_000, 160_000, 0, 14, 30),
      mitigation: "",
      inherentRating: buildRating(4, 3),
      residualRating: buildRating(4, 3),
      baseCostImpact: 95_000,
      costImpact: 95_000,
      scheduleImpactDays: 14,
      probability: 0.7,
    }),
    // --- With mitigation ---
    demoRisk({
      id: "demo-6",
      riskNumber: 6,
      title: "HSE incident — contractor compliance",
      description: "Failure of contractors to maintain required HSE standards could result in incident, enforcement and programme impact.",
      category: "hse" as RiskCategory,
      status: "open",
      owner: "Risk Owner",
      ...preBoth(20, 10_000, 22_000, 50_000, 3, 10, 21),
      mitigation: "Structured audits; mandatory briefings; stop-work authority and incentive scheme.",
      mitigationCost: 5_000,
      ...postBoth(10, 2_000, 8_000, 20_000, 1, 4, 10),
      inherentRating: buildRating(2, 2),
      residualRating: buildRating(2, 2),
      baseCostImpact: 22_000,
      costImpact: 8_000,
      scheduleImpactDays: 4,
      probability: 0.1,
    }),
    demoRisk({
      id: "demo-7",
      riskNumber: 7,
      title: "Programme float — critical path",
      description: "Critical path has limited float; any delay on key activities could propagate and delay completion.",
      category: "programme" as RiskCategory,
      status: "monitoring",
      owner: "Project Manager",
      ...preBoth(60, 80_000, 180_000, 320_000, 21, 45, 90),
      mitigation: "Buffer management; weekly lookahead; early warning and recovery plans.",
      mitigationCost: 0,
      ...postBoth(50, 60_000, 140_000, 240_000, 14, 35, 70),
      inherentRating: buildRating(4, 4),
      residualRating: buildRating(4, 3),
      baseCostImpact: 180_000,
      costImpact: 140_000,
      scheduleImpactDays: 35,
      probability: 0.5,
    }),
    demoRisk({
      id: "demo-8",
      riskNumber: 8,
      title: "Operations handover — documentation",
      description: "Incomplete or late O&M documentation could delay handover and affect client acceptance.",
      category: "operations" as RiskCategory,
      status: "open",
      owner: "Engineering",
      ...preBoth(40, 25_000, 55_000, 100_000, 7, 14, 30),
      mitigation: "Documentation register from day one; dedicated handover lead; client review gates.",
      mitigationCost: 6_000,
      ...postBoth(25, 10_000, 28_000, 55_000, 3, 7, 16),
      inherentRating: buildRating(3, 3),
      residualRating: buildRating(3, 2),
      baseCostImpact: 55_000,
      costImpact: 28_000,
      scheduleImpactDays: 7,
      probability: 0.25,
    }),
    // --- No mitigation (no mitigation text, no post-mitigation fields) ---
    demoRisk({
      id: "demo-9",
      riskNumber: 9,
      title: "Subcontractor default — tier two",
      description: "Default or insolvency of a tier-two subcontractor could leave critical work uncovered and cause cost and delay.",
      category: "commercial" as RiskCategory,
      status: "open",
      owner: "Commercial",
      ...preBoth(25, 200_000, 420_000, 750_000, 30, 60, 120),
      mitigation: "",
      inherentRating: buildRating(2, 5),
      residualRating: buildRating(2, 5),
      baseCostImpact: 420_000,
      costImpact: 420_000,
      scheduleImpactDays: 60,
      probability: 0.25,
    }),
    // --- With mitigation ---
    demoRisk({
      id: "demo-10",
      riskNumber: 10,
      title: "Weather — seasonal delay",
      description: "Adverse weather in winter could delay civil and outdoor works and push completion.",
      category: "construction" as RiskCategory,
      status: "open",
      owner: "Construction",
      ...preBoth(45, 30_000, 65_000, 120_000, 7, 21, 45),
      mitigation: "Weather windows in programme; contingency days; early enclosure of critical areas.",
      mitigationCost: 10_000,
      ...postBoth(30, 15_000, 35_000, 70_000, 3, 12, 28),
      inherentRating: buildRating(3, 3),
      residualRating: buildRating(3, 2),
      baseCostImpact: 65_000,
      costImpact: 35_000,
      scheduleImpactDays: 12,
      probability: 0.3,
    }),
  ];
}

/** Bank of 100 risks (10 copies of each of the 10 templates) for random "Load demo" sampling. */
const DEMO_RISKS_BANK: Risk[] = (() => {
  const base = getDemoRisks();
  const out: Risk[] = [];
  for (let i = 0; i < 100; i++) {
    const template = base[i % 10]!;
    out.push({ ...template, id: `demo-${i + 1}`, riskNumber: i + 1 });
  }
  return out;
})();

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Ensure all runnable-validator fields are present as numbers (handles undefined from spread/persistence). */
function ensureRunnableFields(risk: Risk): Risk {
  const prePct = isNum(risk.preMitigationProbabilityPct) ? risk.preMitigationProbabilityPct : 50;
  const preCostML = isNum(risk.preMitigationCostML) ? risk.preMitigationCostML : (risk.baseCostImpact ?? 0);
  const preTimeML = isNum(risk.preMitigationTimeML) ? risk.preMitigationTimeML : 0;
  const preCostMin = isNum(risk.preMitigationCostMin) ? risk.preMitigationCostMin : 0;
  const preCostMax = isNum(risk.preMitigationCostMax) ? risk.preMitigationCostMax : Math.max(preCostML, preCostMin);
  const preTimeMin = isNum(risk.preMitigationTimeMin) ? risk.preMitigationTimeMin : 0;
  const preTimeMax = isNum(risk.preMitigationTimeMax) ? risk.preMitigationTimeMax : Math.max(preTimeML, preTimeMin);

  const hasMitigation = Boolean(risk.mitigation?.trim());
  const postPct = isNum(risk.postMitigationProbabilityPct) ? risk.postMitigationProbabilityPct : 30;
  const postCostML = isNum(risk.postMitigationCostML) ? risk.postMitigationCostML : (risk.costImpact ?? preCostML);
  const postTimeML = isNum(risk.postMitigationTimeML) ? risk.postMitigationTimeML : (risk.scheduleImpactDays ?? preTimeML);
  const postCostMin = isNum(risk.postMitigationCostMin) ? risk.postMitigationCostMin : 0;
  const postCostMax = isNum(risk.postMitigationCostMax) ? risk.postMitigationCostMax : Math.max(postCostML, postCostMin);
  const postTimeMin = isNum(risk.postMitigationTimeMin) ? risk.postMitigationTimeMin : 0;
  const postTimeMax = isNum(risk.postMitigationTimeMax) ? risk.postMitigationTimeMax : Math.max(postTimeML, postTimeMin);

  return {
    ...risk,
    preMitigationProbabilityPct: prePct,
    preMitigationCostMin: preCostMin,
    preMitigationCostML: preCostML,
    preMitigationCostMax: preCostMax,
    preMitigationTimeMin: preTimeMin,
    preMitigationTimeML: preTimeML,
    preMitigationTimeMax: preTimeMax,
    ...(hasMitigation
      ? {
          postMitigationProbabilityPct: postPct,
          postMitigationCostMin: postCostMin,
          postMitigationCostML: postCostML,
          postMitigationCostMax: postCostMax,
          postMitigationTimeMin: postTimeMin,
          postMitigationTimeML: postTimeML,
          postMitigationTimeMax: postTimeMax,
        }
      : {
          postMitigationProbabilityPct: undefined,
          postMitigationCostMin: undefined,
          postMitigationCostML: undefined,
          postMitigationCostMax: undefined,
          postMitigationTimeMin: undefined,
          postMitigationTimeML: undefined,
          postMitigationTimeMax: undefined,
        }),
  };
}

/**
 * Returns `count` risks randomly chosen from the 100-risk bank, each cloned with a new unique id.
 * Status is preserved from the template (e.g. "open", "mitigating", "monitoring").
 * All required runnable fields (pre/post cost and time min, ML, max) are guaranteed numeric.
 * Used by "Add x10" and "Add x1" in the risk register.
 */
export function getRandomDemoRisksToAdd(count: number): Risk[] {
  const shuffled = [...DEMO_RISKS_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((r) => {
    const base = {
      ...r,
      id: makeId(),
      riskNumber: undefined,
    };
    return ensureRunnableFields(base);
  });
}
