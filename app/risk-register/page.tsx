"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import { selectDecisionByRiskId, selectDecisionScoreDelta } from "@/store/selectors";
import { loadProjectContext, isProjectContextComplete } from "@/lib/projectContext";
import type { Risk } from "@/domain/risk/risk.schema";
import { mergeDraftToRisk } from "@/domain/risk/risk.mapper";
import type { RiskMergeCluster, MergeRiskDraft } from "@/domain/risk/risk-merge.types";
import { RiskRegisterHeader } from "@/components/risk-register/RiskRegisterHeader";
import {
  RiskRegisterTable,
  type SortColumn,
  type TableSortState,
  type ColumnFilters,
} from "@/components/risk-register/RiskRegisterTable";
import { AddRiskModal } from "@/components/risk-register/AddRiskModal";
import { RiskDetailModal } from "@/components/risk-register/RiskDetailModal";
import { CreateRiskFileModal } from "@/components/risk-register/CreateRiskFileModal";
import { CreateRiskAIModal } from "@/components/risk-register/CreateRiskAIModal";
import { AddNewRiskChoiceModal } from "@/components/risk-register/AddNewRiskChoiceModal";
import { AIReviewDrawer } from "@/components/risk-register/AIReviewDrawer";
const FOCUS_HIGHLIGHT_CLASS = "risk-focus-highlight";
const HIGHLIGHT_DURATION_MS = 2000;

const LEVEL_LETTER: Record<string, string> = { low: "L", medium: "M", high: "H", extreme: "E" };
function getRiskColumnValue(risk: Risk, column: SortColumn): string {
  switch (column) {
    case "riskId":
      return risk.riskNumber != null ? String(risk.riskNumber).padStart(3, "0") : "";
    case "title":
      return risk.title?.trim() ?? "";
    case "category":
      return risk.category;
    case "owner":
      return risk.owner ?? "—";
    case "preRating":
      return LEVEL_LETTER[risk.inherentRating.level] ?? "L";
    case "postRating":
      return risk.mitigation?.trim() ? (LEVEL_LETTER[risk.residualRating.level] ?? "L") : "N/A";
    case "mitigationMovement": {
      const pre = risk.inherentRating.score;
      const post = risk.residualRating.score;
      if (post > pre) return "↑";
      if (post < pre) return "↓";
      return "→";
    }
    case "status":
      return risk.status;
    default:
      return "";
  }
}

function applyColumnFilters<T>(list: T[], filters: ColumnFilters, getValue: (item: T, col: SortColumn) => string): T[] {
  let result = list;
  for (const col of Object.keys(filters) as SortColumn[]) {
    const values = filters[col];
    if (!values?.length) continue;
    const set = new Set(values);
    result = result.filter((item) => set.has(getValue(item, col)));
  }
  return result;
}

function RiskRegisterContent() {
  const { risks, simulation, addRisk, updateRisk } = useRiskRegister();
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);
  const [aiClusters, setAiClusters] = useState<RiskMergeCluster[]>([]);
  const [aiReviewSkippedIds, setAiReviewSkippedIds] = useState<Set<string>>(new Set());
  const [tableSortState, setTableSortState] = useState<TableSortState>(null);
  const [projectContext, setProjectContext] = useState<ReturnType<typeof loadProjectContext>>(null);
  const [gateChecked, setGateChecked] = useState(false);
  const [showAddRiskModal, setShowAddRiskModal] = useState(false);
  const [showAddNewRiskChoiceModal, setShowAddNewRiskChoiceModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailInitialRiskId, setDetailInitialRiskId] = useState<string | null>(null);
  const [showCreateRiskFileModal, setShowCreateRiskFileModal] = useState(false);
  const [showCreateRiskAIModal, setShowCreateRiskAIModal] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusRiskId = searchParams.get("focusRiskId");
  const highlightTimeoutRef = useRef<number | null>(null);

  // Gate: redirect to /project if project context is missing or incomplete
  useEffect(() => {
    const ctx = loadProjectContext();
    setProjectContext(ctx);
    setGateChecked(true);
  }, []);
  useEffect(() => {
    if (!gateChecked) return;
    if (!isProjectContextComplete(projectContext)) {
      router.replace("/project");
      return;
    }
  }, [gateChecked, projectContext, router]);

  const state = useMemo(() => ({ simulation }), [simulation]);
  const decisionById = useMemo(() => selectDecisionByRiskId(state), [state]);
  const scoreDeltaByRiskId = useMemo(() => selectDecisionScoreDelta(state), [state]);

  const { filteredRisks, risksForFilterOptions } = useMemo(() => {
    let list = risks.filter((r) => r.status !== "archived");
    const risksForFilterOptions = list;
    list = applyColumnFilters(list, columnFilters, getRiskColumnValue);

    if (tableSortState) {
      const { column, direction } = tableSortState;
      const mult = direction === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        let cmp = 0;
        switch (column) {
          case "riskId":
            cmp = (a.riskNumber ?? 0) - (b.riskNumber ?? 0);
            break;
          case "title":
            cmp = (a.title || "").localeCompare(b.title || "");
            break;
          case "category":
            cmp = (a.category || "").localeCompare(b.category || "");
            break;
          case "owner":
            cmp = (a.owner ?? "").localeCompare(b.owner ?? "");
            break;
          case "preRating":
            cmp = a.inherentRating.score - b.inherentRating.score;
            break;
          case "postRating":
            cmp = a.residualRating.score - b.residualRating.score;
            break;
          case "mitigationMovement": {
            const deltaA = a.residualRating.score - a.inherentRating.score;
            const deltaB = b.residualRating.score - b.inherentRating.score;
            cmp = deltaA - deltaB;
            break;
          }
          case "status":
            cmp = (a.status || "").localeCompare(b.status || "");
            break;
          default:
            break;
        }
        return mult * cmp;
      });
    }
    return { filteredRisks: list, risksForFilterOptions };
  }, [risks, columnFilters, tableSortState]);

  // When opening the detail modal for a newly added risk, it may not be in filteredRisks (e.g. "Show flagged only").
  // Ensure the initial risk is included so the modal shows the correct risk instead of defaulting to the first filtered one.
  const risksForDetailModal = useMemo(() => {
    if (!detailInitialRiskId) return filteredRisks;
    if (filteredRisks.some((r) => r.id === detailInitialRiskId)) return filteredRisks;
    const initialRisk = risks.find((r) => r.id === detailInitialRiskId);
    if (!initialRisk) return filteredRisks;
    return [initialRisk, ...filteredRisks];
  }, [filteredRisks, detailInitialRiskId, risks]);

  useEffect(() => {
    if (!focusRiskId) return;
    const el = document.getElementById(`risk-${focusRiskId}`);
    if (!el) return;

    const delayId = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add(FOCUS_HIGHLIGHT_CLASS);
      highlightTimeoutRef.current = window.setTimeout(() => {
        el.classList.remove(FOCUS_HIGHLIGHT_CLASS);
        highlightTimeoutRef.current = null;
        router.replace("/risk-register", { scroll: false });
      }, HIGHLIGHT_DURATION_MS);
    }, 100);

    return () => {
      clearTimeout(delayId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
      el.classList.remove(FOCUS_HIGHLIGHT_CLASS);
    };
  }, [focusRiskId, router]);

  const handleAiReviewClick = useCallback(async () => {
    setAiReviewOpen(true);
    setAiReviewError(null);
    setAiClusters([]);
    setAiReviewSkippedIds(new Set());
    setAiReviewLoading(true);
    const projectId = projectContext?.projectName ?? "default";
    try {
      const payload = { projectId, risks: risks.filter((r) => r.status !== "archived") };
      const res = await fetch("/api/ai/risk-merge-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let msg = typeof data?.error === "string" ? data.error : "AI review failed";
        const details = data?.details as Array<{ path?: string; message?: string }> | undefined;
        if (Array.isArray(details) && details.length > 0) {
          const parts = details.slice(0, 5).map((d) => (d.path ? `${d.path}: ${d.message ?? ""}` : d.message ?? ""));
          if (parts.some(Boolean)) msg += " — " + parts.filter(Boolean).join("; ");
        }
        setAiReviewError(msg);
        setAiClusters([]);
        return;
      }
      setAiClusters(Array.isArray(data.clusters) ? data.clusters : []);
    } catch (e) {
      setAiReviewError(e instanceof Error ? e.message : "Request failed");
      setAiClusters([]);
    } finally {
      setAiReviewLoading(false);
    }
  }, [projectContext?.projectName, risks]);

  const handleAcceptMerge = useCallback(
    (cluster: RiskMergeCluster, draft: MergeRiskDraft) => {
      // Create merged result as a new risk (new id, next riskNumber) to avoid losing information
      const newRisk = mergeDraftToRisk(draft, {
        mergedFromRiskIds: cluster.riskIds,
        aiMergeClusterId: cluster.clusterId,
      });
      // Archive the risks that were merged (keep for completeness, do not delete)
      for (const id of cluster.riskIds) {
        updateRisk(id, { status: "archived" });
      }
      addRisk(newRisk);
      setAiClusters((prev) => prev.filter((c) => c.clusterId !== cluster.clusterId));
    },
    [updateRisk, addRisk]
  );

  const handleSkipCluster = useCallback((clusterId: string) => {
    setAiReviewSkippedIds((prev) => new Set([...prev, clusterId]));
  }, []);

  // Show loading until gate is checked; if incomplete we redirect in useEffect
  if (!gateChecked || !isProjectContextComplete(projectContext)) {
    return (
      <main style={{ padding: 24 }}>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div className="mb-8">
        <RiskRegisterHeader
          projectContext={projectContext}
          onAiReviewClick={handleAiReviewClick}
          aiReviewLoading={aiReviewLoading}
          onGenerateAiRiskClick={() => setShowAddNewRiskChoiceModal(true)}
        />
      </div>
      <RiskRegisterTable
          risks={filteredRisks}
          risksForFilterOptions={risksForFilterOptions}
          decisionById={decisionById}
          scoreDeltaByRiskId={scoreDeltaByRiskId}
          onRiskClick={(risk) => {
            setDetailInitialRiskId(risk.id);
            setShowDetailModal(true);
          }}
          onAddNewClick={() => setShowAddNewRiskChoiceModal(true)}
          sortState={tableSortState}
          onSortByColumn={(column: SortColumn) => {
            setTableSortState((prev) => {
              if (prev?.column === column) {
                return prev.direction === "asc"
                  ? { column, direction: "desc" as const }
                  : null;
              }
              return { column, direction: "asc" as const };
            });
          }}
          columnFilters={columnFilters}
          onColumnFilterChange={(column, values) => {
            setColumnFilters((prev) => ({
              ...prev,
              [column]: values.length > 0 ? values : undefined,
            }));
          }}
        />
      <RiskDetailModal
        open={showDetailModal}
        risks={risksForDetailModal}
        initialRiskId={detailInitialRiskId}
        onClose={() => setShowDetailModal(false)}
        onSave={(risk) => updateRisk(risk.id, risk)}
        onAddNew={() => {
          setShowDetailModal(false);
          setShowAddRiskModal(true);
        }}
        onAddNewWithFile={() => {
          setShowDetailModal(false);
          setShowCreateRiskFileModal(true);
        }}
        onAddNewWithAI={() => {
          setShowDetailModal(false);
          setShowAddNewRiskChoiceModal(true);
        }}
      />
      <AddNewRiskChoiceModal
        open={showAddNewRiskChoiceModal}
        onClose={() => setShowAddNewRiskChoiceModal(false)}
        onRisksAdded={(riskIds) => {
          setShowAddNewRiskChoiceModal(false);
          if (riskIds.length > 0) {
            setDetailInitialRiskId(riskIds[0]);
            setShowDetailModal(true);
          }
        }}
      />
      <CreateRiskFileModal
        open={showCreateRiskFileModal}
        onClose={() => setShowCreateRiskFileModal(false)}
      />
      <CreateRiskAIModal
        open={showCreateRiskAIModal}
        onClose={() => setShowCreateRiskAIModal(false)}
      />
      <AddRiskModal
        open={showAddRiskModal}
        onClose={() => setShowAddRiskModal(false)}
        onAdd={(risk) => {
          addRisk(risk);
          setShowAddRiskModal(false);
        }}
      />
      <AIReviewDrawer
        open={aiReviewOpen}
        onClose={() => setAiReviewOpen(false)}
        loading={aiReviewLoading}
        error={aiReviewError}
        clusters={aiClusters.filter((c) => !aiReviewSkippedIds.has(c.clusterId))}
        risks={risks}
        onAcceptMerge={handleAcceptMerge}
        onSkipCluster={handleSkipCluster}
      />
    </main>
  );
}

export default function RiskRegisterPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
      <RiskRegisterContent />
    </Suspense>
  );
}