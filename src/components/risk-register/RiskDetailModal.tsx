"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type {
  Risk,
  RiskCategory,
  RiskStatus,
  AppliesTo,
} from "@/domain/risk/risk.schema";
import {
  buildRating,
  probabilityPctToScale,
  costToConsequenceScale,
  timeDaysToConsequenceScale,
} from "@/domain/risk/risk.logic";
import { nowIso } from "@/lib/time";
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
  "w-full h-9 px-3 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-transparent";
const selectClass = inputClass;

function formatCostDisplay(value: string): string {
  const trimmed = value.trim().replace(/,/g, "");
  if (trimmed === "") return "";
  const num = parseFloat(trimmed);
  return Number.isFinite(num) ? num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : value;
}
/** Preserves decimal point so values like 1500.50 are not turned into 150050. */
function parseCostInput(value: string): string {
  const allowed = value.replace(/[^\d.]/g, "");
  const firstDot = allowed.indexOf(".");
  if (firstDot === -1) return allowed;
  return allowed.slice(0, firstDot + 1) + allowed.slice(firstDot + 1).replace(/\./g, "");
}
const labelClass = "block text-sm font-medium text-[var(--foreground)] mb-1";

const btnSecondary =
  "px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 shrink-0";
const btnPrimary =
  "px-4 py-2 rounded-md bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 text-sm font-medium hover:bg-neutral-700 dark:hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-400 shrink-0";

/** Special id passed as initialRiskId to open the modal at the "Add new risk" slot. */
export const ADD_NEW_RISK_ID = "__add_new__";

/** For non-draft risks, all key cells are required. When applyMitigation is false, mitigation/post fields are not required. */
function validateNonDraftRisk(form: {
  status: RiskStatus;
  applyMitigation: boolean;
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
  if (form.applyMitigation) {
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

export function RiskDetailModal({
  open,
  risks,
  initialRiskId,
  onClose,
  onSave,
  onAddNew,
  onAddNewWithFile,
  onAddNewWithAI,
}: {
  open: boolean;
  risks: Risk[];
  initialRiskId?: string | null;
  onClose: () => void;
  onSave: (risk: Risk) => void;
  onAddNew?: () => void;
  /** Open flow: Create Risk with AI File Uploader */
  onAddNewWithFile?: () => void;
  /** Open flow: Create Risk with AI (text entry) */
  onAddNewWithAI?: () => void;
}) {
  const getInitialIndex = useCallback((): number => {
    if (initialRiskId === ADD_NEW_RISK_ID) return risks.length;
    if (!initialRiskId || risks.length === 0) return 0;
    const i = risks.findIndex((r) => r.id === initialRiskId);
    return i >= 0 ? i : 0;
  }, [initialRiskId, risks]);

  const [currentIndex, setCurrentIndex] = useState(0);
  // Header (risk ID is read-only model id; title is editable)
  const [title, setTitle] = useState("");
  // General
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RiskCategory>("commercial");
  const [owner, setOwner] = useState("");
  const [ownerCustom, setOwnerCustom] = useState("");
  const [status, setStatus] = useState<RiskStatus>("open");
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("both");
  const [applyMitigation, setApplyMitigation] = useState(true);
  // Pre-Mitigation
  const [preMitigationProbabilityPct, setPreMitigationProbabilityPct] = useState("");
  const [preMitigationCostMin, setPreMitigationCostMin] = useState("");
  const [preMitigationCostML, setPreMitigationCostML] = useState("");
  const [preMitigationCostMax, setPreMitigationCostMax] = useState("");
  const [preMitigationTimeMin, setPreMitigationTimeMin] = useState("");
  const [preMitigationTimeML, setPreMitigationTimeML] = useState("");
  const [preMitigationTimeMax, setPreMitigationTimeMax] = useState("");
  // Mitigation
  const [mitigation, setMitigation] = useState("");
  const [mitigationCost, setMitigationCost] = useState("");
  // Post-Mitigation
  const [postMitigationProbabilityPct, setPostMitigationProbabilityPct] = useState("");
  const [postMitigationCostMin, setPostMitigationCostMin] = useState("");
  const [postMitigationCostML, setPostMitigationCostML] = useState("");
  const [postMitigationCostMax, setPostMitigationCostMax] = useState("");
  const [postMitigationTimeMin, setPostMitigationTimeMin] = useState("");
  const [postMitigationTimeML, setPostMitigationTimeML] = useState("");
  const [postMitigationTimeMax, setPostMitigationTimeMax] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  const didInitialSyncRef = useRef(false);

  const currentRisk = risks[currentIndex] ?? null;
  const totalSlots = risks.length + 1; // last slot is "Add new risk"
  const isAddNewSlot = currentIndex === risks.length;
  const hasMultipleOrAddNew = risks.length >= 1 || isAddNewSlot;
  const isLast = risks.length > 0 && currentIndex === risks.length - 1;
  const isEmpty = risks.length === 0;

  const syncFormFromRisk = useCallback((risk: Risk) => {
    setTitle(risk.title);
    setDescription(risk.description ?? "");
    setCategory(risk.category);
    setStatus(risk.status);
    // Treat legacy "Unassigned" and undefined as no owner (OWNER_OPTIONS no longer includes Unassigned)
    const rawOwner = risk.owner ?? "";
    const ownerVal = rawOwner === "Unassigned" ? "" : rawOwner;
    const isOwnerInList = ownerVal && OWNER_OPTIONS.includes(ownerVal as (typeof OWNER_OPTIONS)[number]);
    setOwner(isOwnerInList ? ownerVal : ownerVal ? "Other" : "");
    setOwnerCustom(isOwnerInList ? "" : ownerVal);
    setAppliesTo(risk.appliesTo ?? "both");
    setApplyMitigation(!!risk.mitigation?.trim());
    setMitigation(risk.mitigation ?? "");
    setMitigationCost(risk.mitigationCost?.toString() ?? "");
    // Pre-Mitigation: from new fields or derive from inherent
    setPreMitigationProbabilityPct(
      risk.preMitigationProbabilityPct != null
        ? String(risk.preMitigationProbabilityPct)
        : String((risk.inherentRating.probability / 5) * 100)
    );
    setPreMitigationCostMin(risk.preMitigationCostMin?.toString() ?? "");
    setPreMitigationCostML(risk.preMitigationCostML?.toString() ?? risk.baseCostImpact?.toString() ?? "");
    setPreMitigationCostMax(risk.preMitigationCostMax?.toString() ?? "");
    setPreMitigationTimeMin(risk.preMitigationTimeMin?.toString() ?? "");
    setPreMitigationTimeML(risk.preMitigationTimeML?.toString() ?? risk.scheduleImpactDays?.toString() ?? "");
    setPreMitigationTimeMax(risk.preMitigationTimeMax?.toString() ?? "");
    // Post-Mitigation: from new fields or derive from residual
    setPostMitigationProbabilityPct(
      risk.postMitigationProbabilityPct != null
        ? String(risk.postMitigationProbabilityPct)
        : String((risk.residualRating.probability / 5) * 100)
    );
    setPostMitigationCostMin(risk.postMitigationCostMin?.toString() ?? "");
    setPostMitigationCostML(risk.postMitigationCostML?.toString() ?? risk.costImpact?.toString() ?? "");
    setPostMitigationCostMax(risk.postMitigationCostMax?.toString() ?? "");
    setPostMitigationTimeMin(risk.postMitigationTimeMin?.toString() ?? "");
    setPostMitigationTimeML(risk.postMitigationTimeML?.toString() ?? "");
    setPostMitigationTimeMax(risk.postMitigationTimeMax?.toString() ?? "");
  }, []);

  useEffect(() => {
    if (!open) {
      didInitialSyncRef.current = false;
      return;
    }
    if (!didInitialSyncRef.current) {
      didInitialSyncRef.current = true;
      const idx = getInitialIndex();
      setCurrentIndex(idx);
      const risk = risks[idx];
      if (risk) syncFormFromRisk(risk);
    }
  }, [open, getInitialIndex, risks, syncFormFromRisk]);

  useEffect(() => {
    if (!open || !currentRisk || currentIndex === risks.length) return;
    syncFormFromRisk(currentRisk);
  }, [currentIndex, open, currentRisk?.id, risks.length, syncFormFromRisk]);

  // Clear validation errors when switching risk or when modal opens
  useEffect(() => {
    if (open) setValidationErrors([]);
  }, [open, currentIndex]);

  // When filter narrows and current index is out of range, jump to first
  useEffect(() => {
    if (!open || risks.length === 0) return;
    if (currentIndex >= risks.length) setCurrentIndex(0);
  }, [open, risks.length, currentIndex]);

  useEffect(() => {
    if (!open || !modalRef.current) return;
    const el = modalRef.current;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    // Focus the dialog container so no field loads in edit mode
    el.focus();
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
  }, [open, currentIndex]);

  const parseNum = (s: string): number | undefined => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : undefined;
  };
  const parseIntNum = (s: string): number | undefined => {
    const v = parseInt(s, 10);
    return Number.isFinite(v) ? v : undefined;
  };

  /** Build the risk as it would be saved from current form state (for dirty check and save). When applyMitigation is false, residual = inherent and no mitigation fields. */
  const buildUpdatedRisk = useCallback((): Risk | null => {
    if (!currentRisk) return null;
    const prePct = parseNum(preMitigationProbabilityPct) ?? 50;
    const preCostML = parseNum(preMitigationCostML) ?? 0;
    const preTimeML = parseIntNum(preMitigationTimeML) ?? 0;
    const applies = appliesTo;
    const preP = probabilityPctToScale(prePct);
    const preC = applies === "time" ? timeDaysToConsequenceScale(preTimeML) : applies === "cost" ? costToConsequenceScale(preCostML) : Math.max(costToConsequenceScale(preCostML), timeDaysToConsequenceScale(preTimeML));
    const inherentRating = buildRating(preP, preC);
    const postPct = applyMitigation ? (parseNum(postMitigationProbabilityPct) ?? 50) : prePct;
    const postCostML = applyMitigation ? (parseNum(postMitigationCostML) ?? preCostML) : preCostML;
    const postTimeML = applyMitigation ? (parseIntNum(postMitigationTimeML) ?? preTimeML) : preTimeML;
    const postP = probabilityPctToScale(postPct);
    const postC = applies === "time" ? timeDaysToConsequenceScale(postTimeML) : applies === "cost" ? costToConsequenceScale(postCostML) : Math.max(costToConsequenceScale(postCostML), timeDaysToConsequenceScale(postTimeML));
    const residualRating = buildRating(postP, postC);
    return {
      ...currentRisk,
      riskNumber: currentRisk.riskNumber,
      title: title.trim() || currentRisk.title,
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
      postMitigationCostMax: applyMitigation ? (parseNum(postMitigationCostMax) ?? undefined) : undefined,
      postMitigationTimeMin: applyMitigation ? parseIntNum(postMitigationTimeMin) : undefined,
      postMitigationTimeML: applyMitigation ? (postTimeML ?? undefined) : undefined,
      postMitigationTimeMax: applyMitigation ? (parseNum(postMitigationTimeMax) ?? undefined) : undefined,
      inherentRating,
      residualRating,
      baseCostImpact: preCostML ?? undefined,
      costImpact: applyMitigation ? (postCostML ?? undefined) : preCostML ?? undefined,
      scheduleImpactDays: applyMitigation ? (postTimeML ?? undefined) : preTimeML ?? undefined,
      probability: (applyMitigation ? postPct : prePct) / 100,
      updatedAt: nowIso(),
    };
  }, [
    currentRisk,
    title,
    description,
    category,
    status,
    owner,
    ownerCustom,
    appliesTo,
    applyMitigation,
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
  ]);

  /** Normalize a risk the same way buildUpdatedRisk normalizes form output, so we can compare without false positives (e.g. "" vs undefined). */
  const normalizeRiskForComparison = useCallback((risk: Risk): Risk => {
    const prePct = risk.preMitigationProbabilityPct ?? (risk.inherentRating.probability / 5) * 100;
    const postPct = risk.postMitigationProbabilityPct ?? (risk.residualRating.probability / 5) * 100;
    const preCostML = risk.preMitigationCostML ?? risk.baseCostImpact ?? 0;
    const preTimeML = risk.preMitigationTimeML ?? risk.scheduleImpactDays ?? 0;
    const postCostML = risk.postMitigationCostML ?? risk.costImpact ?? preCostML;
    const postTimeML = risk.postMitigationTimeML ?? 0;
    const applies = risk.appliesTo ?? "both";
    const preP = probabilityPctToScale(prePct);
    const preC =
      applies === "time"
        ? timeDaysToConsequenceScale(preTimeML)
        : applies === "cost"
          ? costToConsequenceScale(preCostML)
          : Math.max(costToConsequenceScale(preCostML), timeDaysToConsequenceScale(preTimeML));
    const postP = probabilityPctToScale(postPct);
    const postC =
      applies === "time"
        ? timeDaysToConsequenceScale(postTimeML)
        : applies === "cost"
          ? costToConsequenceScale(postCostML)
          : Math.max(costToConsequenceScale(postCostML), timeDaysToConsequenceScale(postTimeML));
    const inherentRating = buildRating(preP, preC);
    const residualRating = buildRating(postP, postC);
    return {
      ...risk,
      title: risk.title.trim() || risk.title,
      description: risk.description?.trim() || undefined,
      category: risk.category,
      status: risk.status,
      owner: risk.owner?.trim() || undefined,
      appliesTo: applies,
      preMitigationProbabilityPct: prePct,
      preMitigationCostMin: risk.preMitigationCostMin ?? undefined,
      preMitigationCostML: preCostML || undefined,
      preMitigationCostMax: risk.preMitigationCostMax ?? undefined,
      preMitigationTimeMin: risk.preMitigationTimeMin ?? undefined,
      preMitigationTimeML: preTimeML || undefined,
      preMitigationTimeMax: risk.preMitigationTimeMax ?? undefined,
      mitigation: risk.mitigation?.trim() || undefined,
      mitigationCost: risk.mitigationCost ?? undefined,
      postMitigationProbabilityPct: postPct,
      postMitigationCostMin: risk.postMitigationCostMin ?? undefined,
      postMitigationCostML: postCostML || undefined,
      postMitigationCostMax: risk.postMitigationCostMax ?? undefined,
      postMitigationTimeMin: risk.postMitigationTimeMin ?? undefined,
      postMitigationTimeML: postTimeML || undefined,
      postMitigationTimeMax: risk.postMitigationTimeMax ?? undefined,
      inherentRating,
      residualRating,
      baseCostImpact: preCostML || undefined,
      costImpact: postCostML || undefined,
      scheduleImpactDays: postTimeML || undefined,
      probability: postPct / 100,
      updatedAt: "",
    };
  }, []);

  const isDirty = (() => {
    if (!currentRisk || currentIndex === risks.length) return false;
    const updated = buildUpdatedRisk();
    if (!updated) return false;
    const normalizedOriginal = normalizeRiskForComparison(currentRisk);
    const a = { ...normalizedOriginal, updatedAt: "" };
    const b = { ...updated, updatedAt: "" };
    return JSON.stringify(a) !== JSON.stringify(b);
  })();

  const [pendingNav, setPendingNav] = useState<"prev" | "next" | "close" | null>(null);
  const showSavePrompt = pendingNav !== null;

  const handleSave = useCallback((): boolean => {
    const updated = buildUpdatedRisk();
    if (!updated) return false;
    const errors = validateNonDraftRisk({
      status,
      applyMitigation,
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
      return false;
    }
    setValidationErrors([]);
    onSave(updated);
    return true;
  }, [
    buildUpdatedRisk,
    onSave,
    status,
    title,
    description,
    owner,
    ownerCustom,
    appliesTo,
    applyMitigation,
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
  ]);

  const handleSaveThenNav = useCallback(() => {
    if (pendingNav === null) return;
    if (!handleSave()) return; // validation failed; stay on current risk and keep prompt open
    if (pendingNav === "prev" && currentIndex > 0) setCurrentIndex((i) => i - 1);
    else if (pendingNav === "next" && currentIndex < risks.length) setCurrentIndex((i) => i + 1);
    else if (pendingNav === "close") onClose();
    setPendingNav(null);
  }, [pendingNav, handleSave, currentIndex, risks.length, onClose]);

  const handleDiscardThenNav = useCallback(() => {
    if (pendingNav === null) return;
    if (pendingNav === "prev" && currentIndex > 0) setCurrentIndex((i) => i - 1);
    else if (pendingNav === "next" && currentIndex < risks.length) setCurrentIndex((i) => i + 1);
    else if (pendingNav === "close") onClose();
    setPendingNav(null);
  }, [pendingNav, currentIndex, risks.length, onClose]);

  const handleCancelNav = useCallback(() => setPendingNav(null), []);

  const requestClose = useCallback(() => {
    if (isDirty && currentRisk && currentIndex !== risks.length) {
      setPendingNav("close");
      return;
    }
    onClose();
  }, [isDirty, currentRisk, currentIndex, risks.length, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  const goPrev = () => {
    if (currentIndex <= 0) return;
    if (isDirty) {
      setPendingNav("prev");
      return;
    }
    setCurrentIndex((i) => i - 1);
  };

  const goNext = () => {
    if (currentIndex >= risks.length) return;
    if (isDirty) {
      setPendingNav("next");
      return;
    }
    setCurrentIndex((i) => i + 1);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) requestClose();
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/75 dark:bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-detail-dialog-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        style={{
          width: "90vw",
          maxWidth: 720,
          maxHeight: "90vh",
          minHeight: "70vh",
        }}
        className="shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-xl flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 shrink-0 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isAddNewSlot ? (
              <h2 id="risk-detail-dialog-title" className="text-lg font-semibold text-[var(--foreground)]">
                Add new risk
              </h2>
            ) : isEmpty ? (
              <h2 id="risk-detail-dialog-title" className="text-lg font-semibold text-[var(--foreground)]">
                No risks
              </h2>
            ) : currentRisk ? (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <span
                  className="w-14 shrink-0 text-lg font-semibold text-[var(--foreground)]"
                  aria-label="Risk ID"
                >
                  {currentRisk.riskNumber != null ? String(currentRisk.riskNumber).padStart(3, "0") : currentRisk.id}
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 min-w-0 text-lg font-semibold text-[var(--foreground)] bg-transparent border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-neutral-300 dark:focus:border-neutral-600"
                  aria-label="Risk title"
                  id="risk-detail-dialog-title"
                />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-2 rounded-md border border-transparent text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 shrink-0"
            aria-label="Close dialog"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col">
          {isEmpty || isAddNewSlot ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center text-neutral-600 dark:text-neutral-400">
              <p className="mb-6">
                {isAddNewSlot ? "Add a new risk to the register." : "There are no risks to review."}
              </p>
              {(onAddNewWithFile != null || onAddNewWithAI != null) ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  {onAddNewWithFile && (
                    <button type="button" onClick={onAddNewWithFile} className={btnPrimary}>
                      Create Risk with AI File Uploader
                    </button>
                  )}
                  {onAddNewWithAI && (
                    <button type="button" onClick={onAddNewWithAI} className={btnPrimary}>
                      Create Risk with AI
                    </button>
                  )}
                </div>
              ) : onAddNew ? (
                <button type="button" onClick={onAddNew} className={btnPrimary}>
                  {isAddNewSlot ? "Add new risk" : "Create new risk"}
                </button>
              ) : null}
            </div>
          ) : (
            currentRisk && (
              <div className="space-y-6">
                {validationErrors.length > 0 && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200" role="alert">
                    <p className="font-medium mb-1">Complete all required fields before saving (non-draft risks):</p>
                    <ul className="list-disc list-inside">{validationErrors.map((e) => <li key={e}>{e}</li>)}</ul>
                  </div>
                )}
                {/* General */}
                <section>
                  <div className="space-y-3">
                    {status === "draft" && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                        This risk is in draft. Change status to Open and save to include it in simulation.
                      </p>
                    )}
                    <div>
                      <label htmlFor="detail-description" className={labelClass}>
                        Description {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}
                      </label>
                      <textarea
                        id="detail-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`${inputClass} resize-y min-h-[80px] h-auto`}
                        placeholder="Include a detailed description of the risk."
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="detail-category" className={labelClass}>
                          Category {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}
                        </label>
                        <select
                          id="detail-category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value as RiskCategory)}
                          className={selectClass}
                        >
                          <option value="" disabled>Select a Category</option>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c.charAt(0).toUpperCase() + c.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="detail-owner" className={labelClass}>
                          Owner {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}
                        </label>
                        <select
                          id="detail-owner"
                          value={owner}
                          onChange={(e) => setOwner(e.target.value)}
                          className={selectClass}
                        >
                          <option value="" disabled>Select an Owner</option>
                          {OWNER_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                        {owner === "Other" && (
                          <input
                            type="text"
                            value={ownerCustom}
                            onChange={(e) => setOwnerCustom(e.target.value)}
                            className={`${inputClass} mt-1`}
                            placeholder="Enter owner"
                          />
                        )}
                      </div>
                      <div>
                        <label htmlFor="detail-status" className={labelClass}>
                          Status {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}
                        </label>
                        <select
                          id="detail-status"
                          value={status}
                          onChange={(e) => setStatus(e.target.value as RiskStatus)}
                          className={selectClass}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="detail-applies-to" className={labelClass}>
                          Applies To {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}
                        </label>
                        <select
                          id="detail-applies-to"
                          value={appliesTo}
                          onChange={(e) => setAppliesTo(e.target.value as AppliesTo)}
                          className={selectClass}
                        >
                          {APPLIES_TO_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
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
                      <label htmlFor="detail-pre-prob" className={labelClass}>
                        Probability % {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}
                      </label>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={Math.min(100, Math.max(0, parseFloat(preMitigationProbabilityPct) || 0))}
                          onChange={(e) => setPreMitigationProbabilityPct(e.target.value)}
                          className="col-span-2 min-w-0 h-2 rounded-lg appearance-none bg-neutral-200 dark:bg-neutral-600 accent-neutral-700 dark:accent-neutral-300"
                          aria-label="Pre-Mitigation Probability %"
                        />
                        <input
                          id="detail-pre-prob"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={preMitigationProbabilityPct}
                          onChange={(e) => setPreMitigationProbabilityPct(e.target.value)}
                          className={inputClass}
                          placeholder="0–100"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="detail-pre-cost-min" className={labelClass}>Cost Min ($) {(status !== "draft" && (appliesTo === "cost" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-cost-min" type="text" inputMode="numeric" value={formatCostDisplay(preMitigationCostMin)} onChange={(e) => setPreMitigationCostMin(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-pre-cost-ml" className={labelClass}>Cost Most Likely ($) {(status !== "draft" && (appliesTo === "cost" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-cost-ml" type="text" inputMode="numeric" value={formatCostDisplay(preMitigationCostML)} onChange={(e) => setPreMitigationCostML(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-pre-cost-max" className={labelClass}>Cost Max ($) {(status !== "draft" && (appliesTo === "cost" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-cost-max" type="text" inputMode="numeric" value={formatCostDisplay(preMitigationCostMax)} onChange={(e) => setPreMitigationCostMax(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="detail-pre-time-min" className={labelClass}>Time Min (days) {(status !== "draft" && (appliesTo === "time" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-time-min" type="number" min={0} step={1} value={preMitigationTimeMin} onChange={(e) => setPreMitigationTimeMin(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-pre-time-ml" className={labelClass}>Time ML (days) {(status !== "draft" && (appliesTo === "time" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-time-ml" type="number" min={0} step={1} value={preMitigationTimeML} onChange={(e) => setPreMitigationTimeML(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-pre-time-max" className={labelClass}>Time Max (days) {(status !== "draft" && (appliesTo === "time" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-time-max" type="number" min={0} step={1} value={preMitigationTimeMax} onChange={(e) => setPreMitigationTimeMax(e.target.value)} className={inputClass} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Apply Mitigation toggle */}
                <section>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[var(--foreground)]">Apply Mitigation</span>
                    <div className="flex rounded-lg border border-neutral-300 dark:border-neutral-600 p-0.5 bg-neutral-100 dark:bg-neutral-800">
                      <button
                        type="button"
                        onClick={() => setApplyMitigation(false)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${!applyMitigation ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"}`}
                        aria-pressed={!applyMitigation}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplyMitigation(true)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${applyMitigation ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"}`}
                        aria-pressed={applyMitigation}
                      >
                        Yes
                      </button>
                    </div>
                  </div>
                </section>

                {applyMitigation && (
                  <>
                {/* Mitigation */}
                <section>
                  <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">Mitigation</h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="detail-mitigation" className={labelClass}>
                        Description {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}
                      </label>
                      <textarea
                        id="detail-mitigation"
                        value={mitigation}
                        onChange={(e) => setMitigation(e.target.value)}
                        className={`${inputClass} resize-y min-h-[60px]`}
                        placeholder="Mitigation strategy"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label htmlFor="detail-mitigation-cost" className={labelClass}>
                        Mitigation Cost ($)
                      </label>
                      <input
                        id="detail-mitigation-cost"
                        type="text"
                        inputMode="numeric"
                        value={formatCostDisplay(mitigationCost)}
                        onChange={(e) => setMitigationCost(parseCostInput(e.target.value))}
                        className={inputClass}
                        placeholder="—"
                      />
                    </div>
                  </div>
                </section>

                {/* Post-Mitigation */}
                <section>
                  <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">Post-Mitigation</h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="detail-post-prob" className={labelClass}>
                        Probability % {status !== "draft" && <span className="text-red-500" aria-label="required">*</span>}
                      </label>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={Math.min(100, Math.max(0, parseFloat(postMitigationProbabilityPct) || 0))}
                          onChange={(e) => setPostMitigationProbabilityPct(e.target.value)}
                          className="col-span-2 min-w-0 h-2 rounded-lg appearance-none bg-neutral-200 dark:bg-neutral-600 accent-neutral-700 dark:accent-neutral-300"
                          aria-label="Post-Mitigation Probability %"
                        />
                        <input
                          id="detail-post-prob"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={postMitigationProbabilityPct}
                          onChange={(e) => setPostMitigationProbabilityPct(e.target.value)}
                          className={inputClass}
                          placeholder="0–100"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="detail-post-cost-min" className={labelClass}>Cost Min ($) {(status !== "draft" && (appliesTo === "cost" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-cost-min" type="text" inputMode="numeric" value={formatCostDisplay(postMitigationCostMin)} onChange={(e) => setPostMitigationCostMin(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-post-cost-ml" className={labelClass}>Cost Most Likely ($) {(status !== "draft" && (appliesTo === "cost" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-cost-ml" type="text" inputMode="numeric" value={formatCostDisplay(postMitigationCostML)} onChange={(e) => setPostMitigationCostML(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-post-cost-max" className={labelClass}>Cost Max ($) {(status !== "draft" && (appliesTo === "cost" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-cost-max" type="text" inputMode="numeric" value={formatCostDisplay(postMitigationCostMax)} onChange={(e) => setPostMitigationCostMax(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="detail-post-time-min" className={labelClass}>Time Min (days) {(status !== "draft" && (appliesTo === "time" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-time-min" type="number" min={0} step={1} value={postMitigationTimeMin} onChange={(e) => setPostMitigationTimeMin(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-post-time-ml" className={labelClass}>Time ML (days) {(status !== "draft" && (appliesTo === "time" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-time-ml" type="number" min={0} step={1} value={postMitigationTimeML} onChange={(e) => setPostMitigationTimeML(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-post-time-max" className={labelClass}>Time Max (days) {(status !== "draft" && (appliesTo === "time" || appliesTo === "both")) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-time-max" type="number" min={0} step={1} value={postMitigationTimeMax} onChange={(e) => setPostMitigationTimeMax(e.target.value)} className={inputClass} />
                      </div>
                    </div>
                  </div>
                </section>
                  </>
                )}
              </div>
            )
          )}
        </div>

        {(!isEmpty || isAddNewSlot) && (
          <div className="flex flex-wrap justify-between items-center gap-3 shrink-0 px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-[var(--background)]">
            <div className="flex gap-2">
              {hasMultipleOrAddNew && !isAddNewSlot && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className={btnSecondary}
                    aria-label="Previous risk"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={currentIndex === risks.length}
                    className={btnSecondary}
                    aria-label="Next risk"
                  >
                    Next
                  </button>
                </>
              )}
              {isAddNewSlot && onAddNew && onAddNewWithFile == null && onAddNewWithAI == null && (
                <button type="button" onClick={onAddNew} className={btnPrimary}>
                  Add new risk
                </button>
              )}
              {!isAddNewSlot && isLast && onAddNew && (
                <button type="button" onClick={onAddNew} className={btnSecondary}>
                  Create new risk
                </button>
              )}
            </div>
            <div className="flex gap-2 ml-auto">
              {!isAddNewSlot && (
                <button type="button" onClick={handleSave} className={btnPrimary}>
                  Save
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showSavePrompt && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl z-10"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="save-prompt-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[var(--background)] border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-4 max-w-sm flex flex-col gap-3">
            <p id="save-prompt-title" className="text-sm font-medium text-[var(--foreground)]">
              You have unsaved changes. Do you want to save the risk?
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <button type="button" onClick={handleCancelNav} className={btnSecondary}>
                Cancel
              </button>
              <button type="button" onClick={handleDiscardThenNav} className={btnSecondary}>
                Don&apos;t save
              </button>
              <button type="button" onClick={handleSaveThenNav} className={btnPrimary}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
