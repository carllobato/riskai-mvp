"use client";

import { useState, useCallback } from "react";
import type { Risk } from "@/domain/risk/risk.schema";
import type { RiskMergeCluster, MergeRiskDraft } from "@/domain/risk/risk-merge.types";

const DRAWER_WIDTH = 420;

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

function ProposedMergedCard({
  draft,
  isEditing,
  onEditChange,
  onDraftChange,
}: {
  draft: MergeRiskDraft;
  isEditing: boolean;
  onEditChange: (v: boolean) => void;
  onDraftChange: (d: MergeRiskDraft) => void;
}) {
  if (!isEditing) {
    return (
      <div className={panelClass}>
        <div className={labelClass}>Proposed merged risk</div>
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
        <button
          type="button"
          onClick={() => onEditChange(true)}
          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Edit merged draft
        </button>
      </div>
    );
  }

  return (
    <div className={panelClass}>
      <div className="flex items-center justify-between mb-2">
        <span className={labelClass}>Edit merged draft</span>
        <button
          type="button"
          onClick={() => onEditChange(false)}
          className="text-xs text-neutral-500 hover:text-[var(--foreground)]"
        >
          Done
        </button>
      </div>
      <label className="block mt-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Title</span>
        <input
          className="w-full mt-0.5 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm"
          value={draft.title}
          onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="block mt-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Description</span>
        <textarea
          className="w-full mt-0.5 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm min-h-[60px]"
          value={draft.description ?? ""}
          onChange={(e) => onDraftChange({ ...draft, description: e.target.value || undefined })}
        />
      </label>
      <label className="block mt-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Owner</span>
        <input
          className="w-full mt-0.5 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm"
          value={draft.owner ?? ""}
          onChange={(e) => onDraftChange({ ...draft, owner: e.target.value || undefined })}
          placeholder="Unassigned"
        />
      </label>
      <label className="block mt-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Mitigation</span>
        <textarea
          className="w-full mt-0.5 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm min-h-[50px]"
          value={draft.mitigation ?? ""}
          onChange={(e) => onDraftChange({ ...draft, mitigation: e.target.value || undefined })}
        />
      </label>
      <label className="block mt-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Mitigation cost ($)</span>
        <input
          type="number"
          min={0}
          step={1000}
          className="w-full mt-0.5 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm"
          value={draft.mitigationCost ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            onDraftChange({ ...draft, mitigationCost: v === "" ? undefined : Math.max(0, Number(v)) });
          }}
        />
      </label>
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
  const [editingDraft, setEditingDraft] = useState<MergeRiskDraft | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const draft = editingDraft ?? cluster.mergedDraft;

  const handleAccept = useCallback(() => {
    if (!draft) return;
    onAccept(cluster, draft);
  }, [cluster, draft, onAccept]);

  return (
    <section className="border border-neutral-200 dark:border-neutral-600 rounded-lg p-4 bg-[var(--background)]">
      <h3 className="font-semibold text-[var(--foreground)]">
        Cluster #{cluster.clusterId} – Similar risks
      </h3>
      <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
        {cluster.riskIds.map((id) => {
          const r = risksById.get(id);
          const displayId = r?.riskNumber != null ? String(r.riskNumber).padStart(3, "0") : id.slice(0, 8);
          return (
            <li key={id}>
              <span className="font-mono text-xs text-neutral-500">{displayId}</span>
              {" · "}
              {r?.title ?? id}
              {r?.category && ` · ${r.category}`}
              {r?.owner && ` · ${r.owner}`}
            </li>
          );
        })}
      </ul>
      <p className={labelClass}>Why these are similar</p>
      <p className={valueClass}>{cluster.rationale}</p>
      {draft ? (
        <>
          <div className="mt-3">
            <ProposedMergedCard
              draft={draft}
              isEditing={isEditing}
              onEditChange={(v) => {
                setIsEditing(v);
                if (v && cluster.mergedDraft) setEditingDraft({ ...cluster.mergedDraft });
              }}
              onDraftChange={(d) => setEditingDraft(d)}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleAccept}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 hover:opacity-90"
            >
              Accept merge
            </button>
            <button
              type="button"
              onClick={() => onSkip(cluster.clusterId)}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Skip
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => onSkip(cluster.clusterId)}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
        className="fixed inset-0 bg-black/40 z-40"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[100vw] bg-[var(--background)] border-l border-neutral-200 dark:border-neutral-700 shadow-xl flex flex-col"
        style={{ width: DRAWER_WIDTH }}
        role="dialog"
        aria-labelledby="ai-review-title"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
          <h2 id="ai-review-title" className="text-lg font-semibold text-[var(--foreground)]">
            AI Review – Similar risk merge
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            aria-label="Close"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Reviewing risks…</p>
          )}
          {error && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200" role="alert">
              {error}
            </div>
          )}
          {!loading && !error && clusters.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No similar risk groups to merge. Try again after adding more risks.
            </p>
          )}
          {!loading && !error && clusters.length > 0 && (
            <div className="space-y-4">
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
    </>
  );
}
