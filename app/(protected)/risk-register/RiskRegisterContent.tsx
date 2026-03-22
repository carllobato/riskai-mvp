"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import { selectDecisionByRiskId, selectDecisionScoreDelta } from "@/store/selectors";
import { loadProjectContext, isProjectContextComplete } from "@/lib/projectContext";
import { listRisks, replaceRisks, DEFAULT_PROJECT_ID } from "@/lib/db/risks";
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
import { RiskRegisterLookupProviders } from "@/components/risk-register/RiskRegisterLookupProviders";
import { isRiskStatusArchived, RISK_STATUS_ARCHIVED_LOOKUP } from "@/domain/risk/riskFieldSemantics";
import { useProjectPermissions } from "@/contexts/ProjectPermissionsContext";
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

export type RiskRegisterContentProps = { projectId?: string | null };

export function RiskRegisterContent({ projectId: urlProjectId }: RiskRegisterContentProps = {}) {
  const { risks, simulation, addRisk, updateRisk, setRisks, archiveRisk, restoreArchivedRisk } =
    useRiskRegister();
  const [saveToServerLoading, setSaveToServerLoading] = useState(false);
  const [saveToServerError, setSaveToServerError] = useState<string | null>(null);
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
  const [registerView, setRegisterView] = useState<"active" | "archived">("active");
  const [risksLoadError, setRisksLoadError] = useState<string | null>(null);
  const [risksLoading, setRisksLoading] = useState(true);
  const [loadRetryKey, setLoadRetryKey] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusRiskId = searchParams.get("focusRiskId");
  const highlightTimeoutRef = useRef<number | null>(null);
  const prevRisksLengthRef = useRef(risks.length);
  const hasHydratedFromDbRef = useRef(false);
  const projectIdForHydrateRef = useRef<string | null>(null);

  const setupRedirectPath = urlProjectId ? `/projects/${urlProjectId}` : "/";
  /** UUID for DB/API: URL project when in project routes, else default (legacy). projectContext.projectName is a display name, not a UUID. */
  const projectIdForDb = urlProjectId ?? DEFAULT_PROJECT_ID;

  const projectPermissions = useProjectPermissions();
  const contentReadOnly =
    Boolean(urlProjectId) &&
    (projectPermissions == null || !projectPermissions.canEditContent);

  useEffect(() => {
    if (contentReadOnly && urlProjectId && process.env.NODE_ENV === "development") {
      console.log("[project-access] risk register read-only UI", { projectId: urlProjectId });
    }
  }, [contentReadOnly, urlProjectId]);

  // Gate: load project context for gate/display. When urlProjectId is set use project-specific key; else legacy global key.
  useEffect(() => {
    const ctx = loadProjectContext(urlProjectId ?? undefined);
    setProjectContext(ctx);
    setGateChecked(true);
  }, [urlProjectId]);
  useEffect(() => {
    if (!gateChecked) return;
    if (urlProjectId) return;
    if (!isProjectContextComplete(projectContext)) {
      router.replace(setupRedirectPath);
      return;
    }
  }, [gateChecked, projectContext, router, setupRedirectPath, urlProjectId]);

  // Hydrate risk store from Supabase only on initial mount or when projectId changes.
  // No fallback to local/example data: on failure show error and clear risks.
  useEffect(() => {
    if (!isProjectContextComplete(projectContext) && !urlProjectId) return;
    if (projectIdForDb !== projectIdForHydrateRef.current) {
      projectIdForHydrateRef.current = projectIdForDb;
      hasHydratedFromDbRef.current = false;
    }
    if (hasHydratedFromDbRef.current && loadRetryKey === 0) return;
    if (loadRetryKey > 0) hasHydratedFromDbRef.current = false;
    hasHydratedFromDbRef.current = true;
    setRisksLoading(true);
    setRisksLoadError(null);
    listRisks(projectIdForDb)
      .then((loaded) => {
        setRisks(loaded);
        setRisksLoadError(null);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setRisksLoadError(msg);
        setRisks([]);
        if (process.env.NODE_ENV === "development") {
          console.error("[risks] listRisks failed", err);
        }
      })
      .finally(() => setRisksLoading(false));
  }, [projectContext, urlProjectId, projectIdForDb, setRisks, loadRetryKey]);

  // Log when risk list grows (after add/append) for debugging visibility of new risks (dev only)
  useEffect(() => {
    if (risks.length > prevRisksLengthRef.current && process.env.NODE_ENV === "development") {
      console.log("[risk-ui] after add", {
        total: risks.length,
        ids: risks.map((r) => r.id ?? (r as Risk & { tempId?: string }).tempId).slice(-5),
      });
    }
    prevRisksLengthRef.current = risks.length;
  }, [risks]);

  /** Merge server-returned risks with current local risks: prefer server values so DB-populated data is not overwritten; only use local when server value is missing (e.g. legacy DB without extended columns). When matchByIndex is true (e.g. right after replaceRisks), pairs by array index so newly saved risks with temp IDs that got real UUIDs still get local fallbacks. Otherwise matches by id only. */
  const mergeServerRisksWithLocal = useCallback(
    (serverRisks: Risk[], localRisks: Risk[], matchByIndex?: boolean): Risk[] => {
      const preferServer = <T,>(serverVal: T, localVal: T): T =>
        serverVal !== undefined && serverVal !== null ? serverVal : localVal;
      const applyLocalOverrides = (server: Risk, local: Risk): Risk => ({
        ...server,
        riskNumber: preferServer(server.riskNumber, local.riskNumber),
        appliesTo: preferServer(server.appliesTo, local.appliesTo),
        preMitigationCostMin: preferServer(server.preMitigationCostMin, local.preMitigationCostMin),
        preMitigationCostML: preferServer(server.preMitigationCostML, local.preMitigationCostML),
        preMitigationCostMax: preferServer(server.preMitigationCostMax, local.preMitigationCostMax),
        preMitigationTimeMin: preferServer(server.preMitigationTimeMin, local.preMitigationTimeMin),
        preMitigationTimeML: preferServer(server.preMitigationTimeML, local.preMitigationTimeML),
        preMitigationTimeMax: preferServer(server.preMitigationTimeMax, local.preMitigationTimeMax),
        postMitigationCostMin: preferServer(server.postMitigationCostMin, local.postMitigationCostMin),
        postMitigationCostML: preferServer(server.postMitigationCostML, local.postMitigationCostML),
        postMitigationCostMax: preferServer(server.postMitigationCostMax, local.postMitigationCostMax),
        postMitigationTimeMin: preferServer(server.postMitigationTimeMin, local.postMitigationTimeMin),
        postMitigationTimeML: preferServer(server.postMitigationTimeML, local.postMitigationTimeML),
        postMitigationTimeMax: preferServer(server.postMitigationTimeMax, local.postMitigationTimeMax),
        probability: preferServer(server.probability, local.probability),
      });
      if (matchByIndex && serverRisks.length === localRisks.length) {
        return serverRisks.map((serverRisk, i) =>
          applyLocalOverrides(serverRisk, localRisks[i]!)
        );
      }
      return serverRisks.map((serverRisk) => {
        const localById = localRisks.find((r) => r.id === serverRisk.id);
        if (localById) return applyLocalOverrides(serverRisk, localById);
        return serverRisk;
      });
    },
    []
  );

  const handleSaveToServer = useCallback(async () => {
    setSaveToServerLoading(true);
    setSaveToServerError(null);
    try {
      const saved = await replaceRisks(risks, projectIdForDb);
      setRisks(mergeServerRisksWithLocal(saved, risks, true));
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof (err as { message?: string })?.message === "string"
            ? (err as { message: string }).message
            : String(err);
      setSaveToServerError(msg);
      console.error("[risks]", err);
    } finally {
      setSaveToServerLoading(false);
    }
  }, [risks, setRisks, projectIdForDb, mergeServerRisksWithLocal]);

  const state = useMemo(() => ({ simulation }), [simulation]);
  const decisionById = useMemo(() => selectDecisionByRiskId(state), [state]);
  const scoreDeltaByRiskId = useMemo(() => selectDecisionScoreDelta(state), [state]);

  const { filteredRisks, risksForFilterOptions } = useMemo(() => {
    const baseList =
      registerView === "active"
        ? risks.filter((r) => !isRiskStatusArchived(r.status))
        : risks.filter((r) => isRiskStatusArchived(r.status));

    if (registerView === "active") {
      console.log("[risk-ui] active register excludes archived", {
        totalInStore: risks.length,
        activeVisibleBeforeColumnFilters: baseList.length,
      });
    }

    let list = baseList;
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
  }, [risks, columnFilters, tableSortState, registerView]);

  if (process.env.NODE_ENV === "development") {
    console.log("[risk-ui] render", {
      total: risks.length,
      visible: filteredRisks.length,
      filterState: columnFilters,
    });
  }

  // When opening the detail modal for a newly added risk, it may not be in filteredRisks (e.g. "Show flagged only").
  // Ensure the initial risk is included so the modal shows the correct risk instead of defaulting to the first filtered one.
  const risksForDetailModal = useMemo(() => {
    const inView = (r: Risk) =>
      registerView === "active" ? !isRiskStatusArchived(r.status) : isRiskStatusArchived(r.status);
    if (!detailInitialRiskId) return filteredRisks;
    if (filteredRisks.some((r) => r.id === detailInitialRiskId)) return filteredRisks;
    const initialRisk = risks.find((r) => r.id === detailInitialRiskId);
    if (!initialRisk || !inView(initialRisk)) return filteredRisks;
    return [initialRisk, ...filteredRisks];
  }, [filteredRisks, detailInitialRiskId, risks, registerView]);

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
        router.replace(urlProjectId ? `/projects/${urlProjectId}/risks` : "/", { scroll: false });
      }, HIGHLIGHT_DURATION_MS);
    }, 100);

    return () => {
      clearTimeout(delayId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
      el.classList.remove(FOCUS_HIGHLIGHT_CLASS);
    };
  }, [focusRiskId, router, urlProjectId]);

  const handleAiReviewClick = useCallback(async () => {
    if (contentReadOnly) return;
    setAiReviewOpen(true);
    setAiReviewError(null);
    setAiClusters([]);
    setAiReviewSkippedIds(new Set());
    setAiReviewLoading(true);
    const projectIdForApi = projectIdForDb;
    try {
      const payload = {
        projectId: projectIdForApi,
        risks: risks.filter((r) => !isRiskStatusArchived(r.status)),
      };
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
  }, [contentReadOnly, projectIdForDb, risks]);

  const handleAcceptMerge = useCallback(
    (cluster: RiskMergeCluster, draft: MergeRiskDraft) => {
      if (contentReadOnly) return;
      // Create merged result as a new risk (new id, next riskNumber) to avoid losing information
      const newRisk = mergeDraftToRisk(draft, {
        mergedFromRiskIds: cluster.riskIds,
        aiMergeClusterId: cluster.clusterId,
      });
      console.log("[risk lookup] selected status on save", newRisk.status);
      console.log("[risk lookup] selected applies_to on save", newRisk.appliesTo);
      // Archive the risks that were merged (keep for completeness, do not delete)
      for (const id of cluster.riskIds) {
        console.log("[risks] archived (merge accept)", { riskId: id, status: RISK_STATUS_ARCHIVED_LOOKUP });
        updateRisk(id, { status: RISK_STATUS_ARCHIVED_LOOKUP });
      }
      addRisk(newRisk);
      setAiClusters((prev) => prev.filter((c) => c.clusterId !== cluster.clusterId));
    },
    [addRisk, contentReadOnly, updateRisk]
  );

  const handleSkipCluster = useCallback((clusterId: string) => {
    setAiReviewSkippedIds((prev) => new Set([...prev, clusterId]));
  }, []);

  const handleRetryLoad = useCallback(() => {
    setRisksLoadError(null);
    setLoadRetryKey((k) => k + 1);
  }, []);

  // Show loading until gate is checked; in legacy mode (no urlProjectId) also require complete projectContext before showing content.
  const blockContent = !gateChecked || (!urlProjectId && !isProjectContextComplete(projectContext));

  if (blockContent) {
    return (
      <RiskRegisterLookupProviders projectId={projectIdForDb}>
        <main className="p-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
        </main>
      </RiskRegisterLookupProviders>
    );
  }

  if (risksLoading) {
    return (
      <RiskRegisterLookupProviders projectId={projectIdForDb}>
      <main className="p-6">
        <div className="mb-6">
          <RiskRegisterHeader
            projectContext={projectContext}
            readOnlyContent={contentReadOnly}
            onAiReviewClick={contentReadOnly ? undefined : handleAiReviewClick}
            aiReviewLoading={aiReviewLoading}
            onGenerateAiRiskClick={
              contentReadOnly ? undefined : () => setShowAddNewRiskChoiceModal(true)
            }
            onSaveToServer={contentReadOnly ? undefined : handleSaveToServer}
            saveToServerLoading={saveToServerLoading}
          />
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading risks…</p>
      </main>
      </RiskRegisterLookupProviders>
    );
  }

  if (risksLoadError) {
    return (
      <RiskRegisterLookupProviders projectId={projectIdForDb}>
      <main className="p-6">
        <div className="mb-6">
          <RiskRegisterHeader
            projectContext={projectContext}
            readOnlyContent={contentReadOnly}
            onAiReviewClick={contentReadOnly ? undefined : handleAiReviewClick}
            aiReviewLoading={aiReviewLoading}
            onGenerateAiRiskClick={
              contentReadOnly ? undefined : () => setShowAddNewRiskChoiceModal(true)
            }
            onSaveToServer={contentReadOnly ? undefined : handleSaveToServer}
            saveToServerLoading={saveToServerLoading}
          />
        </div>
        <div
          className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 p-4"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Failed to load risks
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{risksLoadError}</p>
          <button
            type="button"
            onClick={handleRetryLoad}
            className="mt-3 px-3 py-1.5 text-sm font-medium rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-neutral-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Retry
          </button>
        </div>
      </main>
      </RiskRegisterLookupProviders>
    );
  }

  return (
    <RiskRegisterLookupProviders projectId={projectIdForDb}>
    <main className="p-6">
      <div className="mb-6">
        <RiskRegisterHeader
          projectContext={projectContext}
          readOnlyContent={contentReadOnly}
          onAiReviewClick={contentReadOnly ? undefined : handleAiReviewClick}
          aiReviewLoading={aiReviewLoading}
          onGenerateAiRiskClick={
            contentReadOnly ? undefined : () => setShowAddNewRiskChoiceModal(true)
          }
          onSaveToServer={contentReadOnly ? undefined : handleSaveToServer}
          saveToServerLoading={saveToServerLoading}
        />
        {saveToServerError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            Save failed: {saveToServerError}
          </p>
        )}
      </div>
      {risks.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-8 text-center">
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">No risks in this project</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-500">
            {contentReadOnly
              ? "You have view-only access to this project."
              : "Add a risk manually, from file, or with AI to get started."}
          </p>
          {!contentReadOnly && (
            <button
              type="button"
              onClick={() => setShowAddNewRiskChoiceModal(true)}
              className="mt-4 px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              Add risk
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className="flex flex-wrap gap-2 mb-4 border-b border-neutral-200 dark:border-neutral-700 pb-3"
            role="tablist"
            aria-label="Risk register view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={registerView === "active"}
              onClick={() => {
                setRegisterView("active");
                setColumnFilters({});
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                registerView === "active"
                  ? "border-neutral-800 dark:border-neutral-200 bg-neutral-100 dark:bg-neutral-800 text-[var(--foreground)]"
                  : "border-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              Active register
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={registerView === "archived"}
              onClick={() => {
                setRegisterView("archived");
                setColumnFilters({});
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                registerView === "archived"
                  ? "border-neutral-800 dark:border-neutral-200 bg-neutral-100 dark:bg-neutral-800 text-[var(--foreground)]"
                  : "border-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              Archived
            </button>
          </div>
          {registerView === "active" &&
            risks.length > 0 &&
            risks.every((r) => isRiskStatusArchived(r.status)) && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                All risks are archived. Open the <strong>Archived</strong> tab to review or restore them.
              </p>
            )}
          {registerView === "archived" && !risks.some((r) => isRiskStatusArchived(r.status)) && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">No archived risks.</p>
          )}
          <RiskRegisterTable
            risks={filteredRisks}
            risksForFilterOptions={risksForFilterOptions}
            decisionById={decisionById}
            scoreDeltaByRiskId={scoreDeltaByRiskId}
            onRiskClick={(risk) => {
              setDetailInitialRiskId(risk.id);
              setShowDetailModal(true);
            }}
            onArchivedRestore={
              registerView === "archived" && !contentReadOnly
                ? (risk) => {
                    restoreArchivedRisk(risk.id);
                  }
                : undefined
            }
            onAddNewClick={
              registerView === "active" && !contentReadOnly
                ? () => setShowAddNewRiskChoiceModal(true)
                : undefined
            }
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
            readOnly={contentReadOnly}
            onClose={() => setShowDetailModal(false)}
            onSave={(risk) => updateRisk(risk.id, risk)}
            onArchiveRisk={
              registerView === "active" && !contentReadOnly ? (id) => archiveRisk(id) : undefined
            }
            onRestoreRisk={
              registerView === "archived" && !contentReadOnly
                ? (id) => restoreArchivedRisk(id)
                : undefined
            }
            onAddNew={
              contentReadOnly
                ? undefined
                : () => {
                    setShowDetailModal(false);
                    setShowAddRiskModal(true);
                  }
            }
            onAddNewWithFile={
              contentReadOnly
                ? undefined
                : () => {
                    setShowDetailModal(false);
                    setShowCreateRiskFileModal(true);
                  }
            }
            onAddNewWithAI={
              contentReadOnly
                ? undefined
                : () => {
                    setShowDetailModal(false);
                    setShowAddNewRiskChoiceModal(true);
                  }
            }
          />
        </>
      )}
      <AddNewRiskChoiceModal
        open={showAddNewRiskChoiceModal}
        onClose={() => setShowAddNewRiskChoiceModal(false)}
        onAddManualRisk={() => {
          setShowAddNewRiskChoiceModal(false);
          setShowAddRiskModal(true);
        }}
        onRisksAdded={(riskIds) => {
          setColumnFilters({});
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
    </RiskRegisterLookupProviders>
  );
}
