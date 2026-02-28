"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Risk, RiskCategory, RiskStatus, AppliesTo } from "@/domain/risk/risk.schema";
import { createRisk } from "@/domain/risk/risk.factory";
import {
  buildRating,
  probabilityPctToScale,
  costToConsequenceScale,
  timeDaysToConsequenceScale,
} from "@/domain/risk/risk.logic";
import { OWNER_OPTIONS, APPLIES_TO_OPTIONS } from "./riskFormConstants";

const CATEGORIES: RiskCategory[] = [
  "commercial",
  "programme",
  "design",
  "construction",
  "procurement",
  "hse",
  "authority",
  "operations",
  "other",
];

const STATUSES: RiskStatus[] = ["draft", "open", "monitoring", "mitigating", "closed"];

const inputClass =
  "w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-transparent";
const labelClass = "block text-sm font-medium text-[var(--foreground)] mb-1";

const btnSecondary =
  "px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 shrink-0";
const btnPrimary =
  "px-4 py-2 rounded-md bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 text-sm font-medium hover:bg-neutral-700 dark:hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-400 shrink-0";

export function AddRiskModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (risk: Risk) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RiskCategory>("commercial");
  const [owner, setOwner] = useState<string>("Unassigned");
  const [ownerCustom, setOwnerCustom] = useState("");
  const [status, setStatus] = useState<RiskStatus>("open");
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("both");
  const [preMitigationProbabilityPct, setPreMitigationProbabilityPct] = useState("50");
  const [preMitigationCostMin, setPreMitigationCostMin] = useState("");
  const [preMitigationCostML, setPreMitigationCostML] = useState("");
  const [preMitigationCostMax, setPreMitigationCostMax] = useState("");
  const [preMitigationTimeMin, setPreMitigationTimeMin] = useState("");
  const [preMitigationTimeML, setPreMitigationTimeML] = useState("");
  const [preMitigationTimeMax, setPreMitigationTimeMax] = useState("");
  const [mitigation, setMitigation] = useState("");
  const [mitigationCost, setMitigationCost] = useState("");
  const [postMitigationProbabilityPct, setPostMitigationProbabilityPct] = useState("50");
  const [postMitigationCostMin, setPostMitigationCostMin] = useState("");
  const [postMitigationCostML, setPostMitigationCostML] = useState("");
  const [postMitigationCostMax, setPostMitigationCostMax] = useState("");
  const [postMitigationTimeMin, setPostMitigationTimeMin] = useState("");
  const [postMitigationTimeML, setPostMitigationTimeML] = useState("");
  const [postMitigationTimeMax, setPostMitigationTimeMax] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !modalRef.current) return;
    const el = modalRef.current;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first) first.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const target = e.target as HTMLElement;
      if (!el.contains(target)) return;
      if (e.shiftKey) {
        if (target === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (target === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setCategory("commercial");
      setOwner("Unassigned");
      setOwnerCustom("");
      setStatus("open");
      setAppliesTo("both");
      setPreMitigationProbabilityPct("50");
      setPreMitigationCostMin("");
      setPreMitigationCostML("");
      setPreMitigationCostMax("");
      setPreMitigationTimeMin("");
      setPreMitigationTimeML("");
      setPreMitigationTimeMax("");
      setMitigation("");
      setMitigationCost("");
      setPostMitigationProbabilityPct("50");
      setPostMitigationCostMin("");
      setPostMitigationCostML("");
      setPostMitigationCostMax("");
      setPostMitigationTimeMin("");
      setPostMitigationTimeML("");
      setPostMitigationTimeMax("");
    }
  }, [open]);

  const parseNum = (s: string): number | undefined => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : undefined;
  };
  const parseIntNum = (s: string): number | undefined => {
    const v = parseInt(s, 10);
    return Number.isFinite(v) ? v : undefined;
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const prePct = parseNum(preMitigationProbabilityPct) ?? 50;
      const postPct = parseNum(postMitigationProbabilityPct) ?? 50;
      const preCostML = parseNum(preMitigationCostML) ?? 0;
      const preTimeML = parseIntNum(preMitigationTimeML) ?? 0;
      const postCostML = parseNum(postMitigationCostML) ?? preCostML;
      const postTimeML = parseIntNum(postMitigationTimeML) ?? preTimeML;
      const applies = appliesTo;
      const preP = probabilityPctToScale(prePct);
      const preC = applies === "time" ? timeDaysToConsequenceScale(preTimeML) : applies === "cost" ? costToConsequenceScale(preCostML) : Math.max(costToConsequenceScale(preCostML), timeDaysToConsequenceScale(preTimeML));
      const postP = probabilityPctToScale(postPct);
      const postC = applies === "time" ? timeDaysToConsequenceScale(postTimeML) : applies === "cost" ? costToConsequenceScale(postCostML) : Math.max(costToConsequenceScale(postCostML), timeDaysToConsequenceScale(postTimeML));
      const inherentRating = buildRating(preP, preC);
      const residualRating = buildRating(postP, postC);
      const risk = createRisk({
        title: title.trim() || "Untitled risk",
        description: description.trim() || undefined,
        category,
        status,
        owner: (owner === "Other" ? ownerCustom.trim() : owner) || undefined,
        appliesTo: applies,
        preMitigationProbabilityPct: prePct,
        preMitigationCostMin: parseNum(preMitigationCostMin),
        preMitigationCostML: preCostML || undefined,
        preMitigationCostMax: parseNum(preMitigationCostMax) || undefined,
        preMitigationTimeMin: parseIntNum(preMitigationTimeMin),
        preMitigationTimeML: preTimeML || undefined,
        preMitigationTimeMax: parseIntNum(preMitigationTimeMax) || undefined,
        mitigation: mitigation.trim() || undefined,
        mitigationCost: parseNum(mitigationCost) || undefined,
        postMitigationProbabilityPct: postPct,
        postMitigationCostMin: parseNum(postMitigationCostMin),
        postMitigationCostML: postCostML || undefined,
        postMitigationCostMax: parseNum(postMitigationCostMax) || undefined,
        postMitigationTimeMin: parseIntNum(postMitigationTimeMin),
        postMitigationTimeML: postTimeML || undefined,
        postMitigationTimeMax: parseIntNum(postMitigationTimeMax) || undefined,
        inherentRating,
        residualRating,
        baseCostImpact: preCostML || undefined,
        costImpact: postCostML || undefined,
        scheduleImpactDays: postTimeML || undefined,
        probability: postPct / 100,
      });
      onAdd(risk);
      onClose();
    },
    [
      title,
      description,
      category,
      status,
      owner,
      ownerCustom,
      appliesTo,
      preMitigationProbabilityPct,
      preMitigationCostMin,
      preMitigationCostML,
      preMitigationCostMax,
      preMitigationTimeMin,
      preMitigationTimeML,
      preMitigationTimeMax,
      mitigation,
      mitigationCost,
      postMitigationProbabilityPct,
      postMitigationCostMin,
      postMitigationCostML,
      postMitigationCostMax,
      postMitigationTimeMin,
      postMitigationTimeML,
      postMitigationTimeMax,
      onAdd,
      onClose,
    ]
  );

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/75 dark:bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-risk-dialog-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        style={{ width: "80vw", height: "80vh", maxWidth: "100vw", maxHeight: "100vh" }}
        className="shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-xl min-h-[400px] min-w-[280px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title + close */}
        <div className="flex items-center justify-between gap-4 shrink-0 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 py-3">
          <h2
            id="add-risk-dialog-title"
            className="text-lg font-semibold text-[var(--foreground)]"
          >
            Add risk
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md border border-transparent text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-transparent"
            aria-label="Close dialog"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-5 space-y-6">
            {/* General */}
            <section>
              <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">General</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="add-risk-title" className={labelClass}>Title <span className="text-red-500">*</span></label>
                  <input id="add-risk-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Long lead switchgear" required />
                </div>
                <div>
                  <label htmlFor="add-risk-description" className={labelClass}>Description</label>
                  <textarea id="add-risk-description" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-y min-h-[80px]`} placeholder="Optional description" rows={2} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="add-risk-category" className={labelClass}>Category</label>
                    <select id="add-risk-category" value={category} onChange={(e) => setCategory(e.target.value as RiskCategory)} className={inputClass}>
                      {CATEGORIES.map((c) => (<option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="add-risk-owner" className={labelClass}>Owner</label>
                    <select id="add-risk-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
                      {OWNER_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                    </select>
                    {owner === "Other" && (
                      <input type="text" value={ownerCustom} onChange={(e) => setOwnerCustom(e.target.value)} className={`${inputClass} mt-1`} placeholder="Enter owner" />
                    )}
                  </div>
                  <div>
                    <label htmlFor="add-risk-status" className={labelClass}>Status</label>
                    <select id="add-risk-status" value={status} onChange={(e) => setStatus(e.target.value as RiskStatus)} className={inputClass}>
                      {STATUSES.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="add-risk-applies-to" className={labelClass}>Applies To</label>
                    <select id="add-risk-applies-to" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as AppliesTo)} className={inputClass}>
                      {APPLIES_TO_OPTIONS.map(({ value, label }) => (<option key={value} value={value}>{label}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* Pre-Mitigation */}
            <section>
              <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">Pre-Mitigation</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="add-risk-pre-prob" className={labelClass}>Probability %</label>
                  <input id="add-risk-pre-prob" type="number" min={0} max={100} step={1} value={preMitigationProbabilityPct} onChange={(e) => setPreMitigationProbabilityPct(e.target.value)} className={inputClass} placeholder="0–100" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={labelClass}>Cost Min ($)</label><input type="number" min={0} step={1000} value={preMitigationCostMin} onChange={(e) => setPreMitigationCostMin(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Cost Most Likely ($)</label><input type="number" min={0} step={1000} value={preMitigationCostML} onChange={(e) => setPreMitigationCostML(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Cost Max ($)</label><input type="number" min={0} step={1000} value={preMitigationCostMax} onChange={(e) => setPreMitigationCostMax(e.target.value)} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={labelClass}>Time Min (days)</label><input type="number" min={0} step={1} value={preMitigationTimeMin} onChange={(e) => setPreMitigationTimeMin(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Time ML (days)</label><input type="number" min={0} step={1} value={preMitigationTimeML} onChange={(e) => setPreMitigationTimeML(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Time Max (days)</label><input type="number" min={0} step={1} value={preMitigationTimeMax} onChange={(e) => setPreMitigationTimeMax(e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            </section>

            {/* Mitigation */}
            <section>
              <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">Mitigation</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="add-risk-mitigation" className={labelClass}>Description</label>
                  <textarea id="add-risk-mitigation" value={mitigation} onChange={(e) => setMitigation(e.target.value)} className={`${inputClass} resize-y min-h-[60px]`} placeholder="Mitigation strategy" rows={2} />
                </div>
                <div>
                  <label htmlFor="add-risk-mitigation-cost" className={labelClass}>Mitigation Cost ($)</label>
                  <input id="add-risk-mitigation-cost" type="number" min={0} step={1000} value={mitigationCost} onChange={(e) => setMitigationCost(e.target.value)} className={inputClass} placeholder="—" />
                </div>
              </div>
            </section>

            {/* Post-Mitigation */}
            <section>
              <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">Post-Mitigation</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="add-risk-post-prob" className={labelClass}>Probability %</label>
                  <input id="add-risk-post-prob" type="number" min={0} max={100} step={1} value={postMitigationProbabilityPct} onChange={(e) => setPostMitigationProbabilityPct(e.target.value)} className={inputClass} placeholder="0–100" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={labelClass}>Cost Min ($)</label><input type="number" min={0} step={1000} value={postMitigationCostMin} onChange={(e) => setPostMitigationCostMin(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Cost Most Likely ($)</label><input type="number" min={0} step={1000} value={postMitigationCostML} onChange={(e) => setPostMitigationCostML(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Cost Max ($)</label><input type="number" min={0} step={1000} value={postMitigationCostMax} onChange={(e) => setPostMitigationCostMax(e.target.value)} className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={labelClass}>Time Min (days)</label><input type="number" min={0} step={1} value={postMitigationTimeMin} onChange={(e) => setPostMitigationTimeMin(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Time ML (days)</label><input type="number" min={0} step={1} value={postMitigationTimeML} onChange={(e) => setPostMitigationTimeML(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Time Max (days)</label><input type="number" min={0} step={1} value={postMitigationTimeMax} onChange={(e) => setPostMitigationTimeMax(e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            </section>
          </div>
          <div className="flex flex-wrap justify-end gap-3 shrink-0 px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-[var(--background)]">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
            <button type="submit" className={btnPrimary}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(overlay, document.body);
}
