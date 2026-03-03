"use client";

import { useState, useCallback, useEffect } from "react";
import type { Risk, RiskCategory, RiskStatus, AppliesTo } from "@/domain/risk/risk.schema";
import type { RiskMergeCluster, MergeRiskDraft } from "@/domain/risk/risk-merge.types";
import { OWNER_OPTIONS, APPLIES_TO_OPTIONS } from "./riskFormConstants";

const CATEGORIES: RiskCategory[] = [
  "commercial", "programme", "design", "construction", "procurement", "hse", "authority", "operations", "other",
];
const STATUSES: RiskStatus[] = ["draft", "open", "monitoring", "mitigating", "closed", "archived"];

const panelClass =
  "rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 p-3 text-sm";
const labelClass = "text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mt-2 first:mt-0";
const valueClass = "text-[var(--foreground)] mt-0.5";

function formatPct(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}
function formatCost(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
function formatDays(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n} days`;
}

/** Comparable row: label + value from Risk or from MergeRiskDraft */
function riskValue(risk: Risk, key: string): string {
  switch (key) {
    case "title":
      return risk.title ?? "—";
    case "description":
      return risk.description?.trim() || "—";
    case "category":
      return risk.category ?? "—";
    case "status":
      return risk.status ?? "—";
    case "owner":
      return risk.owner?.trim() || "Unassigned";
    case "mitigation":
      return risk.mitigation?.trim() || "—";
    case "contingency":
      return risk.contingency?.trim() || "—";
    case "appliesTo":
      return risk.appliesTo ?? "—";
    case "preMitigationProbabilityPct": {
      const p = risk.preMitigationProbabilityPct ?? (risk.inherentRating ? (risk.inherentRating.probability / 5) * 100 : undefined);
      return formatPct(p);
    }
    case "preMitigationCostMin":
      return risk.preMitigationCostMin != null ? formatCost(risk.preMitigationCostMin) : "—";
    case "preMitigationCostML":
      return formatCost(risk.preMitigationCostML ?? risk.baseCostImpact);
    case "preMitigationCostMax":
      return risk.preMitigationCostMax != null ? formatCost(risk.preMitigationCostMax) : "—";
    case "preMitigationTimeMin":
      return risk.preMitigationTimeMin != null ? formatDays(risk.preMitigationTimeMin) : "—";
    case "preMitigationTimeML":
      return formatDays(risk.preMitigationTimeML ?? risk.scheduleImpactDays);
    case "preMitigationTimeMax":
      return risk.preMitigationTimeMax != null ? formatDays(risk.preMitigationTimeMax) : "—";
    case "mitigationCost":
      return risk.mitigationCost != null ? formatCost(risk.mitigationCost) : "—";
    case "postMitigationProbabilityPct": {
      const p = risk.postMitigationProbabilityPct ?? (risk.residualRating ? (risk.residualRating.probability / 5) * 100 : undefined);
      return formatPct(p);
    }
    case "postMitigationCostMin":
      return risk.postMitigationCostMin != null ? formatCost(risk.postMitigationCostMin) : "—";
    case "postMitigationCostML":
      return formatCost(risk.postMitigationCostML ?? risk.costImpact);
    case "postMitigationCostMax":
      return risk.postMitigationCostMax != null ? formatCost(risk.postMitigationCostMax) : "—";
    case "postMitigationTimeMin":
      return risk.postMitigationTimeMin != null ? formatDays(risk.postMitigationTimeMin) : "—";
    case "postMitigationTimeML":
      return formatDays(risk.postMitigationTimeML ?? risk.scheduleImpactDays);
    case "postMitigationTimeMax":
      return risk.postMitigationTimeMax != null ? formatDays(risk.postMitigationTimeMax) : "—";
    default:
      return "—";
  }
}

function draftValue(draft: MergeRiskDraft, key: string): string {
  switch (key) {
    case "title":
      return draft.title ?? "—";
    case "description":
      return draft.description?.trim() || "—";
    case "category":
      return draft.category ?? "—";
    case "status":
      return draft.status ?? "—";
    case "owner":
      return draft.owner?.trim() || "Unassigned";
    case "mitigation":
      return draft.mitigation?.trim() || "—";
    case "contingency":
      return draft.contingency?.trim() || "—";
    case "appliesTo":
      return draft.appliesTo ?? "—";
    case "preMitigationProbabilityPct":
      return formatPct(draft.preMitigationProbabilityPct);
    case "preMitigationCostMin":
      return draft.preMitigationCostMin != null ? formatCost(draft.preMitigationCostMin) : "—";
    case "preMitigationCostML":
      return formatCost(draft.preMitigationCostML);
    case "preMitigationCostMax":
      return draft.preMitigationCostMax != null ? formatCost(draft.preMitigationCostMax) : "—";
    case "preMitigationTimeMin":
      return draft.preMitigationTimeMin != null ? formatDays(draft.preMitigationTimeMin) : "—";
    case "preMitigationTimeML":
      return formatDays(draft.preMitigationTimeML);
    case "preMitigationTimeMax":
      return draft.preMitigationTimeMax != null ? formatDays(draft.preMitigationTimeMax) : "—";
    case "mitigationCost":
      return draft.mitigationCost != null ? formatCost(draft.mitigationCost) : "—";
    case "postMitigationProbabilityPct":
      return formatPct(draft.postMitigationProbabilityPct);
    case "postMitigationCostMin":
      return draft.postMitigationCostMin != null ? formatCost(draft.postMitigationCostMin) : "—";
    case "postMitigationCostML":
      return formatCost(draft.postMitigationCostML);
    case "postMitigationCostMax":
      return draft.postMitigationCostMax != null ? formatCost(draft.postMitigationCostMax) : "—";
    case "postMitigationTimeMin":
      return draft.postMitigationTimeMin != null ? formatDays(draft.postMitigationTimeMin) : "—";
    case "postMitigationTimeML":
      return formatDays(draft.postMitigationTimeML);
    case "postMitigationTimeMax":
      return draft.postMitigationTimeMax != null ? formatDays(draft.postMitigationTimeMax) : "—";
    default:
      return "—";
  }
}

const inputClass =
  "w-full px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500";

type ComparisonRow = {
  key: string;
  label: string;
  inputType: "text" | "number" | "textarea" | "select";
  selectOptions?: { value: string; label: string }[];
};

const COMPARISON_ROWS: ComparisonRow[] = [
  { key: "title", label: "Title", inputType: "text" },
  { key: "description", label: "Description", inputType: "textarea" },
  {
    key: "category",
    label: "Category",
    inputType: "select",
    selectOptions: CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
  },
  {
    key: "status",
    label: "Status",
    inputType: "select",
    selectOptions: STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
  },
  {
    key: "owner",
    label: "Owner",
    inputType: "select",
    selectOptions: [{ value: "", label: "Select owner" }, ...OWNER_OPTIONS.map((o) => ({ value: o, label: o }))],
  },
  { key: "mitigation", label: "Mitigation", inputType: "textarea" },
  {
    key: "appliesTo",
    label: "Applies to",
    inputType: "select",
    selectOptions: APPLIES_TO_OPTIONS.map(({ value, label }) => ({ value, label })),
  },
  { key: "preMitigationProbabilityPct", label: "Pre-mitigation probability", inputType: "number" },
  { key: "preMitigationCostMin", label: "Pre-mitigation cost (min)", inputType: "number" },
  { key: "preMitigationCostML", label: "Pre-mitigation cost (ML)", inputType: "number" },
  { key: "preMitigationCostMax", label: "Pre-mitigation cost (max)", inputType: "number" },
  { key: "preMitigationTimeMin", label: "Pre-mitigation time (min)", inputType: "number" },
  { key: "preMitigationTimeML", label: "Pre-mitigation time (ML)", inputType: "number" },
  { key: "preMitigationTimeMax", label: "Pre-mitigation time (max)", inputType: "number" },
  { key: "mitigationCost", label: "Mitigation cost", inputType: "number" },
  { key: "postMitigationProbabilityPct", label: "Post-mitigation probability", inputType: "number" },
  { key: "postMitigationCostMin", label: "Post-mitigation cost (min)", inputType: "number" },
  { key: "postMitigationCostML", label: "Post-mitigation cost (ML)", inputType: "number" },
  { key: "postMitigationCostMax", label: "Post-mitigation cost (max)", inputType: "number" },
  { key: "postMitigationTimeMin", label: "Post-mitigation time (min)", inputType: "number" },
  { key: "postMitigationTimeML", label: "Post-mitigation time (ML)", inputType: "number" },
  { key: "postMitigationTimeMax", label: "Post-mitigation time (max)", inputType: "number" },
];

function getDraftInputValue(draft: MergeRiskDraft, key: string): string {
  const v = (draft as Record<string, unknown>)[key];
  if (v == null || v === "") return "";
  return String(v);
}

function setDraftValue(draft: MergeRiskDraft, key: string, value: string): MergeRiskDraft {
  const numKeys = [
    "preMitigationProbabilityPct", "preMitigationCostMin", "preMitigationCostML", "preMitigationCostMax",
    "preMitigationTimeMin", "preMitigationTimeML", "preMitigationTimeMax", "mitigationCost",
    "postMitigationProbabilityPct", "postMitigationCostMin", "postMitigationCostML", "postMitigationCostMax",
    "postMitigationTimeMin", "postMitigationTimeML", "postMitigationTimeMax",
  ];
  if (numKeys.includes(key)) {
    const n = value.trim() === "" ? undefined : Number(value);
    const parsed = n != null && Number.isFinite(n) ? Math.max(0, n) : undefined;
    if (key === "preMitigationProbabilityPct" || key === "postMitigationProbabilityPct") {
      const clamped = parsed != null ? Math.min(100, Math.max(0, parsed)) : undefined;
      return { ...draft, [key]: clamped };
    }
    const isTime = key.includes("Time");
    const final = parsed != null ? (isTime ? Math.floor(parsed) : parsed) : undefined;
    return { ...draft, [key]: final };
  }
  const str = value.trim();
  if (key === "title") {
    return { ...draft, title: str || draft.title };
  }
  return { ...draft, [key]: str === "" ? undefined : str };
}

function ProposedMergedCard({ draft }: { draft: MergeRiskDraft }) {
  return (
    <div className={panelClass}>
      <div className={labelClass}>Proposed merged risk (summary)</div>
      <div className={valueClass}><strong>{draft.title}</strong></div>
      {draft.description && (
        <div className={valueClass + " text-neutral-600 dark:text-neutral-300"}>{draft.description}</div>
      )}
      <div className={labelClass}>Category</div>
      <div className={valueClass}>{draft.category}</div>
      <div className={labelClass}>Owner</div>
      <div className={valueClass}>{draft.owner?.trim() || "Unassigned"}</div>
      <div className={labelClass}>Pre-mitigation</div>
      <div className={valueClass}>
        Probability {formatPct(draft.preMitigationProbabilityPct)} · Cost {formatCost(draft.preMitigationCostML)} · Time {formatDays(draft.preMitigationTimeML)}
      </div>
      {draft.mitigation && (
        <>
          <div className={labelClass}>Mitigation</div>
          <div className={valueClass}>
            {draft.mitigation}
            {draft.mitigationCost != null && draft.mitigationCost > 0 && (
              <span className="text-neutral-500 dark:text-neutral-400"> · Cost {formatCost(draft.mitigationCost)}</span>
            )}
          </div>
        </>
      )}
      <div className={labelClass}>Post-mitigation</div>
      <div className={valueClass}>
        Probability {formatPct(draft.postMitigationProbabilityPct)} · Cost {formatCost(draft.postMitigationCostML)} · Time {formatDays(draft.postMitigationTimeML)}
      </div>
    </div>
  );
}

function ClusterBlock({
  cluster,
  risksById,
  onAccept,
  onSkip,
}: {
  cluster: RiskMergeCluster;
  risksById: Map<string, Risk>;
  onAccept: (cluster: RiskMergeCluster, draft: MergeRiskDraft) => void;
  onSkip: (clusterId: string) => void;
}) {
  const [editingDraft, setEditingDraft] = useState<MergeRiskDraft | null>(() =>
    cluster.mergedDraft ? { ...cluster.mergedDraft } : null
  );
  const draft = editingDraft ?? cluster.mergedDraft;

  useEffect(() => {
    if (cluster.mergedDraft) setEditingDraft({ ...cluster.mergedDraft });
  }, [cluster.clusterId, cluster.mergedDraft]); // Sync when switching cluster or when merged draft updates from parent

  const handleAccept = useCallback(() => {
    if (!draft) return;
    onAccept(cluster, draft);
  }, [cluster, draft, onAccept]);

  const sourceRisks = cluster.riskIds
    .map((id) => risksById.get(id))
    .filter((r): r is Risk => r != null);

  return (
    <section className="border border-neutral-200 dark:border-neutral-600 rounded-xl p-5 bg-[var(--background)]">
      <h3 className="font-semibold text-[var(--foreground)] text-lg">
        Cluster #{cluster.clusterId} – Similar risks
      </h3>
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mt-2">Why these are similar</p>
      <p className="text-sm text-[var(--foreground)] mt-0.5 mb-4">{cluster.rationale}</p>

      {/* Side-by-side comparison table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-600">
        <table className="w-full min-w-[800px] text-sm border-collapse">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800/80">
              <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-300 w-[140px] border-b border-r border-neutral-200 dark:border-neutral-600">
                Parameter
              </th>
              {sourceRisks.map((r) => (
                <th
                  key={r.id}
                  className="text-left py-2 px-3 font-medium text-neutral-700 dark:text-neutral-200 border-b border-r border-neutral-200 dark:border-neutral-600 last:border-r-0 max-w-[220px]"
                >
                  <span className="font-mono text-xs text-neutral-500">
                    {r.riskNumber != null ? String(r.riskNumber).padStart(3, "0") : r.id.slice(0, 8)}
                  </span>
                  <span className="block truncate font-semibold mt-0.5" title={r.title}>
                    {r.title}
                  </span>
                </th>
              ))}
              <th className="text-left py-2 px-3 font-medium text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/20 border-b last:border-r-0 max-w-[220px]">
                Proposed merged (edit below)
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map(({ key, label, inputType, selectOptions }) => (
              <tr
                key={key}
                className="border-b border-neutral-200 dark:border-neutral-600 last:border-b-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30"
              >
                <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400 font-medium border-r border-neutral-200 dark:border-neutral-600 align-top">
                  {label}
                </td>
                {sourceRisks.map((r) => (
                  <td
                    key={r.id}
                    className="py-2 px-3 text-[var(--foreground)] border-r border-neutral-200 dark:border-neutral-600 last:border-r-0 align-top max-w-[220px] break-words"
                  >
                    {riskValue(r, key)}
                  </td>
                ))}
                <td className="py-1 px-2 align-top max-w-[220px] bg-blue-50/30 dark:bg-blue-900/10">
                  {!draft ? (
                    "—"
                  ) : inputType === "textarea" ? (
                    <textarea
                      className={`${inputClass} min-h-[60px] resize-y`}
                      value={getDraftInputValue(draft, key)}
                      onChange={(e) => setEditingDraft(setDraftValue(draft, key, e.target.value))}
                      aria-label={label}
                    />
                  ) : inputType === "select" && selectOptions ? (
                    (() => {
                      const value = getDraftInputValue(draft, key);
                      const options =
                        key === "owner" && value && !OWNER_OPTIONS.includes(value as (typeof OWNER_OPTIONS)[number])
                          ? [...selectOptions, { value, label: value }]
                          : selectOptions;
                      return (
                        <select
                          className={inputClass}
                          value={value}
                          onChange={(e) => setEditingDraft(setDraftValue(draft, key, e.target.value))}
                          aria-label={label}
                        >
                          {options.map((opt) => (
                            <option key={opt.value || "_empty"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      );
                    })()
                  ) : (
                    <input
                      type={inputType}
                      className={inputClass}
                      value={getDraftInputValue(draft, key)}
                      onChange={(e) => setEditingDraft(setDraftValue(draft, key, e.target.value))}
                      aria-label={label}
                      {...(inputType === "number" ? { min: 0, step: key.includes("Pct") ? 1 : key.includes("Time") ? 1 : 1000 } : {})}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <>
          <div className="mt-4">
            <ProposedMergedCard draft={draft} />
          </div>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Accept creates a <strong>new risk</strong> from the proposed values and <strong>archives</strong> the merged risks for completeness.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleAccept}
              className="px-4 py-2 text-sm font-medium rounded-md bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 hover:opacity-90"
            >
              Accept merge (new risk + archive merged)
            </button>
            <button
              type="button"
              onClick={() => onSkip(cluster.clusterId)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Skip
            </button>
          </div>
        </>
      )}
      {!draft && (
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => onSkip(cluster.clusterId)}
            className="px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Skip
          </button>
        </div>
      )}
    </section>
  );
}

export type AIReviewDrawerProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  clusters: RiskMergeCluster[];
  risks: Risk[];
  onAcceptMerge: (cluster: RiskMergeCluster, draft: MergeRiskDraft) => void;
  onSkipCluster: (clusterId: string) => void;
};

export function AIReviewDrawer({
  open,
  onClose,
  loading,
  error,
  clusters,
  risks,
  onAcceptMerge,
  onSkipCluster,
}: AIReviewDrawerProps) {
  const risksById = new Map(risks.map((r) => [r.id, r]));

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-labelledby="ai-review-title"
        aria-modal="true"
      >
        <div
          className="pointer-events-auto w-full max-w-[70vw] max-h-[90vh] flex flex-col bg-[var(--background)] border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
            <h2 id="ai-review-title" className="text-xl font-semibold text-[var(--foreground)]">
              AI Risk Review – Similar risk merge
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
              aria-label="Close"
            >
              <span aria-hidden className="text-xl leading-none">×</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {loading && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Reviewing risks…</p>
            )}
            {error && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200" role="alert">
                {error}
              </div>
            )}
            {!loading && !error && clusters.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No similar risk groups to merge. Try again after adding more risks.
              </p>
            )}
            {!loading && !error && clusters.length > 0 && (
              <div className="space-y-6">
                {clusters.map((c) => (
                  <ClusterBlock
                    key={c.clusterId}
                    cluster={c}
                    risksById={risksById}
                    onAccept={onAcceptMerge}
                    onSkip={onSkipCluster}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
