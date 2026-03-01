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

/** Mirror of RiskDetailModal validateNonDraftRisk for AddRiskModal form. applyMitigation = mitigation text provided. */
function validateAddRiskNonDraft(form: {
  status: RiskStatus;
  title: string;
  description: string;
  owner: string;
  ownerCustom: string;
  appliesTo: AppliesTo;
  preMitigationProbabilityPct: string;
  preMitigationCostMin: string;
  preMitigationCostML: string;
  preMitigationCostMax: string;
  preMitigationTimeMin: string;
  preMitigationTimeML: string;
  preMitigationTimeMax: string;
  mitigation: string;
  postMitigationProbabilityPct: string;
  postMitigationCostMin: string;
  postMitigationCostML: string;
  postMitigationCostMax: string;
  postMitigationTimeMin: string;
  postMitigationTimeML: string;
  postMitigationTimeMax: string;
}): string[] {
  if (form.status === "draft") return [];
  const applyMitigation = !!form.mitigation.trim();
  const errors: string[] = [];
  if (!form.title.trim()) errors.push("Title");
  if (!form.description.trim()) errors.push("Description");
  if (!form.owner.trim() || (form.owner === "Other" && !form.ownerCustom.trim())) errors.push("Owner");
  const prePct = parseFloat(form.preMitigationProbabilityPct);
  if (!Number.isFinite(prePct) || prePct < 0 || prePct > 100) errors.push("Pre-Mitigation Probability %");
  if (form.appliesTo === "cost" || form.appliesTo === "both") {
    const preCostMin = parseFloat(form.preMitigationCostMin);
    if (form.preMitigationCostMin.trim() === "" || !Number.isFinite(preCostMin) || preCostMin < 0) errors.push("Pre-Mitigation Cost Min");
    const v = parseFloat(form.preMitigationCostML);
    if (!Number.isFinite(v) || v < 0) errors.push("Pre-Mitigation Cost Most Likely");
    const preCostMax = parseFloat(form.preMitigationCostMax);
    if (form.preMitigationCostMax.trim() === "" || !Number.isFinite(preCostMax) || preCostMax < 0) errors.push("Pre-Mitigation Cost Max");
  }
  if (form.appliesTo === "time" || form.appliesTo === "both") {
    const preTimeMin = parseInt(form.preMitigationTimeMin, 10);
    if (form.preMitigationTimeMin.trim() === "" || !Number.isFinite(preTimeMin) || preTimeMin < 0) errors.push("Pre-Mitigation Time Min");
    const v = parseInt(form.preMitigationTimeML, 10);
    if (!Number.isFinite(v) || v < 0) errors.push("Pre-Mitigation Time ML (days)");
    const preTimeMax = parseInt(form.preMitigationTimeMax, 10);
    if (form.preMitigationTimeMax.trim() === "" || !Number.isFinite(preTimeMax) || preTimeMax < 0) errors.push("Pre-Mitigation Time Max");
  }
  if (applyMitigation) {
    if (!form.mitigation.trim()) errors.push("Mitigation description");
    const postPct = parseFloat(form.postMitigationProbabilityPct);
    if (!Number.isFinite(postPct) || postPct < 0 || postPct > 100) errors.push("Post-Mitigation Probability %");
    if (form.appliesTo === "cost" || form.appliesTo === "both") {
      const postCostMin = parseFloat(form.postMitigationCostMin);
      if (form.postMitigationCostMin.trim() === "" || !Number.isFinite(postCostMin) || postCostMin < 0) errors.push("Post-Mitigation Cost Min");
      const v = parseFloat(form.postMitigationCostML);
      if (!Number.isFinite(v) || v < 0) errors.push("Post-Mitigation Cost Most Likely");
      const postCostMax = parseFloat(form.postMitigationCostMax);
      if (form.postMitigationCostMax.trim() === "" || !Number.isFinite(postCostMax) || postCostMax < 0) errors.push("Post-Mitigation Cost Max");
    }
    if (form.appliesTo === "time" || form.appliesTo === "both") {
      const postTimeMin = parseInt(form.postMitigationTimeMin, 10);
      if (form.postMitigationTimeMin.trim() === "" || !Number.isFinite(postTimeMin) || postTimeMin < 0) errors.push("Post-Mitigation Time Min");
      const v = parseInt(form.postMitigationTimeML, 10);
      if (!Number.isFinite(v) || v < 0) errors.push("Post-Mitigation Time ML (days)");
      const postTimeMax = parseInt(form.postMitigationTimeMax, 10);
      if (form.postMitigationTimeMax.trim() === "" || !Number.isFinite(postTimeMax) || postTimeMax < 0) errors.push("Post-Mitigation Time Max");
    }
  }
  return errors;
}

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
  const [owner, setOwner] = useState<string>("");
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
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
      setOwner("");
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
      setValidationErrors([]);
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
      const errors = validateAddRiskNonDraft({
        status,
        title,
        description,
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
        postMitigationProbabilityPct,
        postMitigationCostMin,
        postMitigationCostML,
        postMitigationCostMax,
        postMitigationTimeMin,
        postMitigationTimeML,
        postMitigationTimeMax,
      });
      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }
      setValidationErrors([]);
      const applyMitigation = !!mitigation.trim();
      const prePct = parseNum(preMitigationProbabilityPct) ?? 50;
      const postPct = applyMitigation ? (parseNum(postMitigationProbabilityPct) ?? 50) : prePct;
      const preCostML = parseNum(preMitigationCostML) ?? 0;
      const preTimeML = parseIntNum(preMitigationTimeML) ?? 0;
      const postCostML = applyMitigation ? (parseNum(postMitigationCostML) ?? preCostML) : preCostML;
      const postTimeML = applyMitigation ? (parseIntNum(postMitigationTimeML) ?? preTimeML) : preTimeML;
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
        preMitigationCostML: preCostML ?? undefined,
        preMitigationCostMax: parseNum(preMitigationCostMax) ?? undefined,
        preMitigationTimeMin: parseIntNum(preMitigationTimeMin),
        preMitigationTimeML: preTimeML ?? undefined,
        preMitigationTimeMax: parseIntNum(preMitigationTimeMax) ?? undefined,
        mitigation: applyMitigation ? (mitigation.trim() || undefined) : undefined,
        mitigationCost: applyMitigation ? (parseNum(mitigationCost) ?? undefined) : undefined,
        postMitigationProbabilityPct: applyMitigation ? postPct : undefined,
        postMitigationCostMin: applyMitigation ? parseNum(postMitigationCostMin) : undefined,
        postMitigationCostML: applyMitigation ? (postCostML ?? undefined) : undefined,
        postMitigationCostMax: applyMitigation ? parseNum(postMitigationCostMax) : undefined,
        postMitigationTimeMin: applyMitigation ? parseIntNum(postMitigationTimeMin) : undefined,
        postMitigationTimeML: applyMitigation ? (postTimeML ?? undefined) : undefined,
        postMitigationTimeMax: applyMitigation ? parseIntNum(postMitigationTimeMax) : undefined,
        inherentRating,
        residualRating,
        baseCostImpact: preCostML ?? undefined,
        costImpact: postCostML ?? undefined,
        scheduleImpactDays: postTimeML ?? undefined,
        probability: (applyMitigation ? postPct : prePct) / 100,
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
            {validationErrors.length > 0 && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200" role="alert">
                <p className="font-medium mb-1">Complete all required fields before adding (non-draft risks):</p>
                <ul className="list-disc list-inside">{validationErrors.map((err) => <li key={err}>{err}</li>)}</ul>
              </div>
            )}
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
                    <label htmlFor="add-risk-owner" className={labelClass}>Owner {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}</label>
                    <select id="add-risk-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
                      <option value="">Select an Owner</option>
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
