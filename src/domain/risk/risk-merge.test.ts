import { describe, it } from "node:test";
import assert from "node:assert";
import { mergeDraftToRisk } from "./risk.mapper";
import type { Risk } from "./risk.schema";
import type { RiskMergeCluster, MergeRiskDraft } from "./risk-merge.types";
import { RiskMergeReviewResponseSchema } from "./risk-merge.types";

describe("risk-merge", () => {
  describe("mergeDraftToRisk", () => {
    it("produces a risk with mergedFromRiskIds and aiMergeClusterId", () => {
      const draft: MergeRiskDraft = {
        title: "Merged switchgear risk",
        description: "Combined lead time risk",
        category: "procurement",
        owner: "Procurement",
        preMitigationProbabilityPct: 60,
        preMitigationCostML: 100_000,
        postMitigationProbabilityPct: 30,
        postMitigationCostML: 50_000,
      };
      const risk = mergeDraftToRisk(draft, {
        mergedFromRiskIds: ["id-a", "id-b"],
        aiMergeClusterId: "C1",
      });
      assert.strictEqual(risk.title, draft.title);
      assert.deepStrictEqual(risk.mergedFromRiskIds, ["id-a", "id-b"]);
      assert.strictEqual(risk.aiMergeClusterId, "C1");
      assert.ok(risk.id);
      assert.ok(risk.createdAt);
      assert.ok(risk.inherentRating.score >= 1 && risk.inherentRating.score <= 25);
      assert.ok(risk.residualRating.score >= 1 && risk.residualRating.score <= 25);
    });

    it("derives inherent rating from pre-mitigation % and cost/time ML", () => {
      const draft: MergeRiskDraft = {
        title: "Test",
        category: "commercial",
        preMitigationProbabilityPct: 80,
        preMitigationCostML: 500_000,
        preMitigationTimeML: 90,
      };
      const risk = mergeDraftToRisk(draft, {
        mergedFromRiskIds: [],
        aiMergeClusterId: "C0",
      });
      assert.ok(risk.inherentRating.probability >= 4);
      assert.ok(risk.inherentRating.consequence >= 3);
    });
  });

  describe("accept merge updates list correctly", () => {
    it("source risks are archived and one new merged risk is added with audit fields", () => {
      const r1: Risk = {
        id: "risk-1",
        title: "Switchgear delay",
        category: "procurement",
        status: "open",
        inherentRating: { probability: 3, consequence: 3, score: 9, level: "medium" },
        residualRating: { probability: 2, consequence: 2, score: 4, level: "low" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const r2: Risk = {
        id: "risk-2",
        title: "Long lead switchgear",
        category: "procurement",
        status: "open",
        inherentRating: { probability: 4, consequence: 2, score: 8, level: "medium" },
        residualRating: { probability: 3, consequence: 2, score: 6, level: "medium" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const risks: Risk[] = [r1, r2];
      const draft: MergeRiskDraft = {
        title: "Switchgear lead time risk",
        category: "procurement",
        preMitigationProbabilityPct: 50,
        preMitigationCostML: 80_000,
        postMitigationProbabilityPct: 25,
        postMitigationCostML: 20_000,
      };
      const cluster: RiskMergeCluster = {
        clusterId: "C1",
        confidence: 0.9,
        mergeType: "duplicate",
        rationale: "Same driver: switchgear lead time.",
        riskIds: [r1.id, r2.id],
        mergedDraft: draft,
      };

      const newRisk = mergeDraftToRisk(draft, {
        mergedFromRiskIds: cluster.riskIds,
        aiMergeClusterId: cluster.clusterId,
      });
      // Accept merge: archive source risks (do not remove), add new merged risk
      const risksAfterArchive = risks.map((r) =>
        cluster.riskIds.includes(r.id) ? { ...r, status: "Archived" as const } : r
      );
      const nextRisks = [...risksAfterArchive, newRisk];

      assert.strictEqual(nextRisks.length, 3);
      assert.strictEqual(nextRisks[0].status, "Archived");
      assert.strictEqual(nextRisks[1].status, "Archived");
      const merged = nextRisks[2];
      assert.strictEqual(merged.title, draft.title);
      assert.deepStrictEqual(merged.mergedFromRiskIds, [r1.id, r2.id]);
      assert.strictEqual(merged.aiMergeClusterId, cluster.clusterId);
    });
  });

  describe("API response schema", () => {
    it("validates cluster duplicate response", () => {
      const raw = {
        clusters: [
          {
            clusterId: "C1",
            confidence: 0.85,
            mergeType: "duplicate",
            rationale: "Same risk, different wording.",
            riskIds: ["id1", "id2"],
            mergedDraft: {
              title: "Merged risk",
              category: "programme",
              preMitigationProbabilityPct: 40,
              preMitigationCostML: 50_000,
            },
          },
        ],
      };
      const result = RiskMergeReviewResponseSchema.safeParse(raw);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.clusters.length, 1);
        assert.strictEqual(result.data.clusters[0].mergeType, "duplicate");
        assert.strictEqual(result.data.clusters[0].confidence, 0.85);
      }
    });

    it("filters do_not_merge and low confidence (logic: only show mergeType !== do_not_merge and confidence >= 0.65)", () => {
      const raw = {
        clusters: [
          { clusterId: "C1", confidence: 0.9, mergeType: "duplicate", rationale: "Same.", riskIds: ["a", "b"], mergedDraft: { title: "M", category: "commercial" } },
          { clusterId: "C2", confidence: 0.5, mergeType: "overlap", rationale: "Related.", riskIds: ["c", "d"], mergedDraft: { title: "N", category: "commercial" } },
          { clusterId: "C3", confidence: 0.8, mergeType: "do_not_merge", rationale: "Different.", riskIds: ["e", "f"], mergedDraft: { title: "O", category: "commercial" } },
        ],
      };
      const result = RiskMergeReviewResponseSchema.safeParse(raw);
      assert.strictEqual(result.success, true);
      if (result.success) {
        const filtered = result.data.clusters.filter(
          (c) => c.mergeType !== "do_not_merge" && c.confidence >= 0.65
        );
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].clusterId, "C1");
      }
    });
  });
});
