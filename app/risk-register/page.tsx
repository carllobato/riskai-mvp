"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import { selectDecisionByRiskId, selectDecisionScoreDelta } from "@/store/selectors";
import { getForwardSignals } from "@/lib/forwardSignals";
import { loadProjectContext, isProjectContextComplete, formatMoneyMillions } from "@/lib/projectContext";
import { saveFile, loadFiles, markFileImported } from "@/lib/uploadedRiskRegisterStore";
import { parseExcel, sheetToDocumentText } from "@/lib/riskImportExcel";
import type { Risk, RiskDraft } from "@/domain/risk/risk.schema";
import { RiskDraftSchema, RiskSchema } from "@/domain/risk/risk.schema";
import { draftsToRisks } from "@/domain/risk/risk.mapper";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { RiskRegisterHeader } from "@/components/risk-register/RiskRegisterHeader";
import { RiskExtractPanel } from "@/components/risk-register/RiskExtractPanel";
import {
  RiskRegisterTable,
  type SortColumn,
  type TableSortState,
  type ColumnFilters,
} from "@/components/risk-register/RiskRegisterTable";
import { AddRiskModal } from "@/components/risk-register/AddRiskModal";
import { RiskDetailModal, ADD_NEW_RISK_ID } from "@/components/risk-register/RiskDetailModal";
import { CreateRiskFileModal } from "@/components/risk-register/CreateRiskFileModal";
import { CreateRiskAIModal } from "@/components/risk-register/CreateRiskAIModal";
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

function formatProjectSummaryDate(isoDate: string): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return isoDate;
  }
}

const containerClass =
  "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 flex flex-col min-h-[280px]";
const boxTitleClass =
  "text-base font-medium text-[var(--foreground)] mb-2 border-b border-neutral-200 dark:border-neutral-700 pb-2";
const boxDescClass = "text-sm text-neutral-600 dark:text-neutral-400 mb-3";
const boxButtonClass =
  "px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none shrink-0";

function isDraftLike(item: unknown): item is RiskDraft {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return (
    typeof o.probability === "number" &&
    typeof o.consequence === "number" &&
    o.inherentRating === undefined
  );
}

function isRiskLike(item: unknown): item is Risk {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return o.inherentRating != null && typeof o.inherentRating === "object";
}

function normalizeRisks(raw: unknown): Risk[] {
  const list = Array.isArray(raw) ? raw : [];
  const result: Risk[] = [];
  for (const item of list) {
    if (isRiskLike(item)) {
      const parsed = RiskSchema.safeParse(item);
      if (parsed.success) result.push(parsed.data);
    } else if (isDraftLike(item)) {
      const parsed = RiskDraftSchema.safeParse(item);
      if (parsed.success) result.push(draftsToRisks([parsed.data])[0]);
    }
  }
  return result;
}

function hasMeaningfulTitle(risk: Risk): boolean {
  const t = risk.title && String(risk.title).trim();
  return !!t && t.length > 0;
}

function deduplicateByTitle(risks: Risk[]): Risk[] {
  const seen = new Set<string>();
  return risks.filter((r) => {
    const key = String(r.title).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function RiskRegisterContent() {
  const { uiMode } = useProjectionScenario();
  const { risks, simulation, riskForecastsById, addRisk, appendRisks, updateRisk } = useRiskRegister();
  const isDebug = uiMode === "Debug";
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [showProjectedOnly, setShowProjectedOnly] = useState(false);
  const [showEarlyWarningOnly, setShowEarlyWarningOnly] = useState(false);
  const [showCriticalInstabilityOnly, setShowCriticalInstabilityOnly] = useState(false);
  const [sortByInstability, setSortByInstability] = useState(false);
  const [tableSortState, setTableSortState] = useState<TableSortState>(null);
  const [projectContext, setProjectContext] = useState<ReturnType<typeof loadProjectContext>>(null);
  const [gateChecked, setGateChecked] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fileUploadMessage, setFileUploadMessage] = useState<string | null>(null);
  const [lastSavedFileId, setLastSavedFileId] = useState<string | null>(null);
  const [lastSavedFileName, setLastSavedFileName] = useState<string | null>(null);
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [showAddRiskModal, setShowAddRiskModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailInitialRiskId, setDetailInitialRiskId] = useState<string | null>(null);
  const [showCreateRiskFileModal, setShowCreateRiskFileModal] = useState(false);
  const [showCreateRiskAIModal, setShowCreateRiskAIModal] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const earlyWarningCount = useMemo(
    () => risks.filter((r) => riskForecastsById[r.id]?.earlyWarning === true).length,
    [risks, riskForecastsById]
  );

  const { filteredRisks, risksForFilterOptions } = useMemo(() => {
    let list = risks;
    const flagged = (r: (typeof risks)[0]) => (decisionById[r.id]?.alertTags?.length ?? 0) > 0;
    const projected = (r: (typeof risks)[0]) => {
      const s = getForwardSignals(r.id, riskForecastsById);
      return s.hasForecast && (s.projectedCritical || s.mitigationInsufficient);
    };
    const earlyWarning = (r: (typeof risks)[0]) => riskForecastsById[r.id]?.earlyWarning === true;
    const criticalInstability = (r: (typeof risks)[0]) =>
      (riskForecastsById[r.id]?.instability?.index ?? 0) >= 75;
    if (showFlaggedOnly && showProjectedOnly) list = risks.filter((r) => flagged(r) || projected(r));
    else if (showFlaggedOnly) list = risks.filter(flagged);
    else if (showProjectedOnly) list = risks.filter(projected);
    if (showEarlyWarningOnly) list = list.filter(earlyWarning);
    if (showCriticalInstabilityOnly) list = list.filter(criticalInstability);
    if (sortByInstability) {
      list = [...list].sort((a, b) => {
        const ia = riskForecastsById[a.id]?.instability?.index ?? 0;
        const ib = riskForecastsById[b.id]?.instability?.index ?? 0;
        return ib - ia;
      });
    }
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
  }, [
    risks,
    columnFilters,
    showFlaggedOnly,
    showProjectedOnly,
    showEarlyWarningOnly,
    showCriticalInstabilityOnly,
    sortByInstability,
    tableSortState,
    decisionById,
    riskForecastsById,
  ]);

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

  const handleFileSave = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setFileUploadStatus("error");
      setFileUploadMessage("Only .xlsx files are allowed.");
      return;
    }
    setFileUploadStatus("loading");
    setFileUploadMessage(null);
    setGenerateMessage(null);
    try {
      const id = await saveFile(file);
      setLastSavedFileId(id);
      setLastSavedFileName(file.name);
      setFileUploadStatus("success");
    } catch (e) {
      setFileUploadStatus("error");
      setFileUploadMessage(e instanceof Error ? e.message : "Failed to save file.");
    }
  }, []);

  const onFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setFileDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSave(file);
    },
    [handleFileSave]
  );

  const onFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(true);
  }, []);

  const onFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) handleFileSave(file);
    },
    [handleFileSave]
  );

  const handleGenerateRisk = useCallback(async () => {
    if (!lastSavedFileId) {
      setGenerateStatus("error");
      setGenerateMessage("Upload a file first, then click Generate Risk.");
      return;
    }
    setGenerateStatus("loading");
    setGenerateMessage(null);
    try {
      const files = await loadFiles();
      const file = files.find((f) => f.id === lastSavedFileId);
      if (!file) {
        setGenerateStatus("error");
        setGenerateMessage("File not found. Upload it again.");
        return;
      }
      const parsed = await parseExcel(file.blob);
      if (parsed.rows.length === 0 && parsed.headers.length === 0) {
        setGenerateStatus("error");
        setGenerateMessage("Sheet is empty.");
        return;
      }
      const documentText = sheetToDocumentText(parsed);
      const res = await fetch("/api/risks/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "AI extraction failed";
        setGenerateMessage(msg);
        setGenerateStatus("error");
        return;
      }
      let list = normalizeRisks(data?.risks);
      list = list.filter(hasMeaningfulTitle);
      list = deduplicateByTitle(list);
      appendRisks(list);
      await markFileImported(lastSavedFileId);
      setGenerateStatus("success");
      setGenerateMessage(`Imported ${list.length} risks.`);
    } catch (e) {
      setGenerateMessage(e instanceof Error ? e.message : "Network or unexpected error");
      setGenerateStatus("error");
    }
  }, [lastSavedFileId, appendRisks]);

  // Show loading until gate is checked; if incomplete we redirect in useEffect
  if (!gateChecked || !isProjectContextComplete(projectContext)) {
    return (
      <main style={{ padding: 24 }}>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  const name = projectContext?.projectName ?? "—";
  const base =
    projectContext?.projectValue_m != null ? formatMoneyMillions(projectContext.projectValue_m) : "—";
  const contingency =
    projectContext?.contingencyValue_m != null
      ? formatMoneyMillions(projectContext.contingencyValue_m)
      : "—";
  const appetite = projectContext?.riskAppetite ?? "—";
  const targetDate = projectContext?.targetCompletionDate
    ? formatProjectSummaryDate(projectContext.targetCompletionDate)
    : "—";

  return (
    <main style={{ padding: 24 }}>
      {isDebug && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 mb-4 text-sm text-neutral-700 dark:text-neutral-300">
          Project: {name} • Base: {base} • Contingency: {contingency} • Appetite: {appetite} • Target: {targetDate}
          {" · "}
          <Link href="/project" className="underline underline-offset-2 hover:no-underline text-neutral-600 dark:text-neutral-400">
            Edit project
          </Link>
        </div>
      )}
      <div className="mb-8">
        <RiskRegisterHeader
          projectContext={projectContext}
          showReviewRisksButton={filteredRisks.length > 0}
          onReviewRisks={() => {
            setDetailInitialRiskId(null);
            setShowDetailModal(true);
          }}
        />
      </div>
      {isDebug && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Generate risks</h2>
          <div className="grid grid-cols-3 gap-4">
          <div className={`${containerClass} min-w-0`}>
            <h3 className={boxTitleClass}>Generate Risk Manually</h3>
            <button
              type="button"
              onClick={() => setShowAddRiskModal(true)}
              className="border-2 border-dashed rounded-md p-4 text-center text-sm transition-colors flex-1 min-h-[80px] flex flex-col justify-center w-full border-neutral-300 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/30 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 font-medium"
            >
              Add risk
            </button>
          </div>
          <div className={`${containerClass} min-w-0`}>
            <h3 className={boxTitleClass}>Generate Risk with Text Entry</h3>
            <div className="flex-1 min-h-0 flex flex-col">
              <RiskExtractPanel hideTitle showStatus={isDebug} />
            </div>
          </div>
          <div className={`${containerClass} min-w-0`}>
            <h3 className={boxTitleClass}>Generate Risk with a file</h3>
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={onFileInputChange}
                className="hidden"
                aria-label="Upload Excel file"
              />
              <div
                onDragOver={onFileDragOver}
                onDragLeave={onFileDragLeave}
                onDrop={onFileDrop}
                className={`border-2 border-dashed rounded-md p-4 text-center text-sm transition-colors flex-1 min-h-[80px] flex flex-col justify-center ${
                  fileDragOver
                    ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                    : "border-neutral-300 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/30 hover:border-neutral-400 dark:hover:border-neutral-500"
                }`}
              >
                {lastSavedFileId && lastSavedFileName ? (
                  <>
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                      XLSX
                    </span>
                    <p className="text-[var(--foreground)] font-medium mt-2 truncate" title={lastSavedFileName}>
                      {lastSavedFileName}
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-1">
                      Drop another file to replace
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-neutral-600 dark:text-neutral-400 mb-2">
                      {fileDragOver ? "Drop file here…" : "Drag and drop .xlsx here, or"}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={fileUploadStatus === "loading"}
                      className="px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50"
                    >
                      Choose file
                    </button>
                  </>
                )}
              </div>
              {fileUploadStatus === "loading" && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Saving…</p>
              )}
              {fileUploadStatus === "error" && fileUploadMessage && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {fileUploadMessage}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2">
              <button
                type="button"
                onClick={handleGenerateRisk}
                disabled={!lastSavedFileId || generateStatus === "loading"}
                className={`${boxButtonClass} w-full`}
              >
                Generate Risk
              </button>
              {generateStatus === "loading" && (
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</span>
              )}
              {generateStatus === "success" && generateMessage && (
                <span className="text-sm text-blue-600 dark:text-blue-400" role="status">
                  {generateMessage}
                </span>
              )}
              {generateStatus === "error" && generateMessage && (
                <span className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {generateMessage}
                </span>
              )}
            </div>
            </div>
          </div>
        </section>
      )}
      {isDebug && (
        <>
          {earlyWarningCount > 0 && (
            <button
              type="button"
              onClick={() => setShowEarlyWarningOnly((v) => !v)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 16,
                padding: "10px 12px",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 500,
                color: "#a16207",
                backgroundColor: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                borderRadius: 8,
                cursor: "pointer",
              }}
              title="Click to filter table to early warning risks only"
            >
              {earlyWarningCount} risk{earlyWarningCount === 1 ? "" : "s"} in early warning
              {showEarlyWarningOnly && " (filtered)"}
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, marginBottom: 0, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showFlaggedOnly}
                onChange={(e) => setShowFlaggedOnly(e.target.checked)}
              />
              Show flagged only
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showProjectedOnly}
                onChange={(e) => setShowProjectedOnly(e.target.checked)}
              />
              Show projected only
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showEarlyWarningOnly}
                onChange={(e) => setShowEarlyWarningOnly(e.target.checked)}
              />
              Early Warning Only
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showCriticalInstabilityOnly}
                onChange={(e) => setShowCriticalInstabilityOnly(e.target.checked)}
              />
              Critical Instability Only
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={sortByInstability}
                onChange={(e) => setSortByInstability(e.target.checked)}
              />
              Sort by Instability
            </label>
          </div>
        </>
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
          onAddNewClick={() => {
            setDetailInitialRiskId(ADD_NEW_RISK_ID);
            setShowDetailModal(true);
          }}
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
        risks={filteredRisks}
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
          setShowCreateRiskAIModal(true);
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