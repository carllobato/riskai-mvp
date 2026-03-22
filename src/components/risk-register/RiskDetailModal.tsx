"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Risk, RiskStatus, AppliesTo } from "@/domain/risk/risk.schema";
import {
  buildRating,
  probabilityPctToScale,
  probabilityScaleToDisplayPct,
  consequenceScaleFromAppliesTo,
} from "@/domain/risk/risk.logic";
import {
  appliesToAffectsCost,
  appliesToAffectsTime,
  isRiskStatusArchived,
  isRiskStatusDraft,
} from "@/domain/risk/riskFieldSemantics";
import { dlog } from "@/lib/debug";
import { getRiskValidationErrors } from "@/domain/risk/runnable-risk.validator";
import { nowIso } from "@/lib/time";
import { useRiskProjectOwners } from "./RiskProjectOwnersContext";
import { RiskAppliesToSelect } from "./RiskAppliesToSelect";
import { RiskCategorySelect } from "./RiskCategorySelect";
import {
  RiskOwnerPicker,
  getResolvedOwnerPickerValue,
  shouldPersistNewOwnerOnSubmit,
} from "./RiskOwnerPicker";
import { RiskStatusSelect } from "./RiskStatusSelect";

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
const btnDangerOutline =
  "px-4 py-2 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-600 shrink-0";

/** Special id passed as initialRiskId to open the modal at the "Add new risk" slot. */
export const ADD_NEW_RISK_ID = "__add_new__";

/** Deterministic snapshot for dirty comparison: sorted keys (recursively), exclude volatile fields. Ensures nested objects (e.g. inherentRating) don't cause false dirty from key order. */
function toComparableSnapshot(risk: Record<string, unknown>): string {
  const exclude = new Set(["updatedAt", "createdAt", "lastMitigationUpdate", "scoreHistory"]);
  function sortKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    const rec = obj as Record<string, unknown>;
    const keys = Object.keys(rec).filter((k) => !exclude.has(k)).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = sortKeys(rec[k]);
    return out;
  }
  return JSON.stringify(sortKeys(risk));
}

/** For non-draft risks, all key cells are required. When applyMitigation is false, mitigation/post fields are not required. */
function validateNonDraftRisk(form: {
  status: RiskStatus;
  applyMitigation: boolean;
  title: string;
  description: string;
  ownerSelect: string;
  ownerNewDraft: string;
  appliesTo: AppliesTo;
  preMitigationProbabilityPct: string;
  preMitigationCostMin: string;
  preMitigationCostML: string;
  preMitigationCostMax: string;
  preMitigationTimeMin: string;
  preMitigationTimeML: string;
  preMitigationTimeMax: string;
  category: string;
  mitigation: string;
  postMitigationProbabilityPct: string;
  postMitigationCostMin: string;
  postMitigationCostML: string;
  postMitigationCostMax: string;
  postMitigationTimeMin: string;
  postMitigationTimeML: string;
  postMitigationTimeMax: string;
}): string[] {
  const errors: string[] = [];
  if (!form.status.trim()) errors.push("Status");
  if (!form.appliesTo.trim()) errors.push("Applies to");
  if (isRiskStatusDraft(form.status)) return errors;
  if (!form.title.trim()) errors.push("Title");
  if (!form.description.trim()) errors.push("Description");
  if (!form.category.trim()) errors.push("Category");
  const ownerResolved = getResolvedOwnerPickerValue(form.ownerSelect, form.ownerNewDraft);
  if (!ownerResolved) errors.push("Owner");
  const prePct = parseFloat(form.preMitigationProbabilityPct);
  if (!Number.isFinite(prePct) || prePct < 0 || prePct > 100) errors.push("Pre-Mitigation Probability %");
  if (appliesToAffectsCost(form.appliesTo)) {
    const preCostMin = parseFloat(form.preMitigationCostMin);
    if (form.preMitigationCostMin.trim() === "" || !Number.isFinite(preCostMin) || preCostMin < 0) errors.push("Pre-Mitigation Cost Min");
    const v = parseFloat(form.preMitigationCostML);
    if (!Number.isFinite(v) || v < 0) errors.push("Pre-Mitigation Cost Most Likely");
    const preCostMax = parseFloat(form.preMitigationCostMax);
    if (form.preMitigationCostMax.trim() === "" || !Number.isFinite(preCostMax) || preCostMax < 0) errors.push("Pre-Mitigation Cost Max");
  }
  if (appliesToAffectsTime(form.appliesTo)) {
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
    if (appliesToAffectsCost(form.appliesTo)) {
      const postCostMin = parseFloat(form.postMitigationCostMin);
      if (form.postMitigationCostMin.trim() === "" || !Number.isFinite(postCostMin) || postCostMin < 0) errors.push("Post-Mitigation Cost Min");
      const v = parseFloat(form.postMitigationCostML);
      if (!Number.isFinite(v) || v < 0) errors.push("Post-Mitigation Cost Most Likely");
      const postCostMax = parseFloat(form.postMitigationCostMax);
      if (form.postMitigationCostMax.trim() === "" || !Number.isFinite(postCostMax) || postCostMax < 0) errors.push("Post-Mitigation Cost Max");
    }
    if (appliesToAffectsTime(form.appliesTo)) {
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
  readOnly = false,
  onClose,
  onSave,
  onAddNew,
  onAddNewWithFile,
  onAddNewWithAI,
  onArchiveRisk,
  onRestoreRisk,
}: {
  open: boolean;
  risks: Risk[];
  initialRiskId?: string | null;
  /** View-only: block edits and hide save/archive/generate actions. */
  readOnly?: boolean;
  onClose: () => void;
  onSave: (risk: Risk) => void;
  onAddNew?: () => void;
  /** Open flow: Create Risk with AI File Uploader */
  onAddNewWithFile?: () => void;
  /** Open flow: Create Risk with AI (text entry) */
  onAddNewWithAI?: () => void;
  /** Soft-delete: set status to Archived (persist with Save to server). */
  onArchiveRisk?: (riskId: string) => void;
  /** Restore archived risk to Open. */
  onRestoreRisk?: (riskId: string) => void;
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
  const [category, setCategory] = useState("");
  const { createProjectOwner } = useRiskProjectOwners();
  const [ownerSelect, setOwnerSelect] = useState("");
  const [ownerNewDraft, setOwnerNewDraft] = useState("");
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
  /** After a successful Save, store a snapshot so we treat the form as not dirty until the user edits or switches risk. */
  const lastSavedSnapshotRef = useRef<{ id: string; snapshot: string } | null>(null);
  const prevRiskIdRef = useRef<string | null>(null);
  /** Set when we've synced form from currentRisk; avoids false dirty before first sync (e.g. on open). */
  const lastSyncedRiskIdRef = useRef<string | null>(null);
  /** Baseline snapshot captured when we synced; compare form output to this so we're not sensitive to currentRisk reference or recomputation. */
  const lastSyncedBaselineRef = useRef<string | null>(null);

  const currentRisk = risks[currentIndex] ?? null;
  const isAddNewSlot = currentIndex === risks.length;
  const hasMultipleOrAddNew = risks.length >= 1 || isAddNewSlot;
  const hasAddNewSlot = !!(onAddNew ?? onAddNewWithFile ?? onAddNewWithAI);
  const isLast = risks.length > 0 && currentIndex === risks.length - 1;
  const isEmpty = risks.length === 0;

  const syncFormFromRisk = useCallback((risk: Risk) => {
    setTitle(risk.title);
    setDescription(risk.description ?? "");
    setCategory(risk.category);
    setStatus(risk.status);
    const rawOwner = risk.owner ?? "";
    const ownerVal = rawOwner === "Unassigned" ? "" : rawOwner.trim();
    setOwnerSelect(ownerVal);
    setOwnerNewDraft("");
    setAppliesTo(risk.appliesTo ?? "both");
    const hasMitigation = !!risk.mitigation?.trim();
    setApplyMitigation(hasMitigation);
    setMitigation(risk.mitigation ?? "");
    setMitigationCost(risk.mitigationCost?.toString() ?? "");
    const prePct = probabilityScaleToDisplayPct(risk.inherentRating.probability);
    const preCostML = risk.preMitigationCostML ?? 0;
    const preTimeML = risk.preMitigationTimeML ?? 0;
    setPreMitigationProbabilityPct(String(prePct));
    setPreMitigationCostMin(
      risk.preMitigationCostMin?.toString() ?? (preCostML != null ? "0" : "")
    );
    setPreMitigationCostML(String(preCostML));
    setPreMitigationCostMax(
      risk.preMitigationCostMax?.toString() ?? (preCostML != null ? String(preCostML) : "")
    );
    setPreMitigationTimeMin(
      risk.preMitigationTimeMin?.toString() ?? (preTimeML != null ? "0" : "")
    );
    setPreMitigationTimeML(String(preTimeML));
    setPreMitigationTimeMax(
      risk.preMitigationTimeMax?.toString() ?? (preTimeML != null ? String(preTimeML) : "")
    );
    // Post-Mitigation: only set form state when risk has mitigation, so dirty check (buildUpdatedRisk with applyMitigation) matches. When no mitigation, leave post fields empty so we don't get false positives.
    if (hasMitigation) {
      const postPct = probabilityScaleToDisplayPct(risk.residualRating.probability);
      const postCostML = risk.postMitigationCostML ?? preCostML;
      const postTimeML = risk.postMitigationTimeML ?? preTimeML;
      setPostMitigationProbabilityPct(String(postPct));
      setPostMitigationCostMin(
        risk.postMitigationCostMin?.toString() ?? (postCostML != null ? "0" : "")
      );
      setPostMitigationCostML(postCostML != null ? String(postCostML) : "");
      setPostMitigationCostMax(
        risk.postMitigationCostMax?.toString() ?? (postCostML != null ? String(postCostML) : "")
      );
      setPostMitigationTimeMin(
        risk.postMitigationTimeMin?.toString() ?? (postTimeML != null ? "0" : "")
      );
      setPostMitigationTimeML(postTimeML != null ? String(postTimeML) : "");
      setPostMitigationTimeMax(
        risk.postMitigationTimeMax?.toString() ?? (postTimeML != null ? String(postTimeML) : "")
      );
    } else {
      setPostMitigationProbabilityPct("");
      setPostMitigationCostMin("");
      setPostMitigationCostML("");
      setPostMitigationCostMax("");
      setPostMitigationTimeMin("");
      setPostMitigationTimeML("");
      setPostMitigationTimeMax("");
    }
  }, []);

  useEffect(() => {
    if (!open) {
      didInitialSyncRef.current = false;
      lastSavedSnapshotRef.current = null;
      prevRiskIdRef.current = null;
      lastSyncedRiskIdRef.current = null;
      lastSyncedBaselineRef.current = null;
      return;
    }
    if (!didInitialSyncRef.current) {
      didInitialSyncRef.current = true;
      const idx = getInitialIndex();
      const risk = risks[idx];
      setCurrentIndex(idx);
      if (risk) {
        syncFormFromRisk(risk);
        lastSyncedRiskIdRef.current = risk.id;
      }
    }
  }, [open, getInitialIndex, risks, syncFormFromRisk]);

  /** Normalize a risk the same way buildUpdatedRisk normalizes form output, so we can compare without false positives (e.g. "" vs undefined). When there is no mitigation text, post-mitigation fields are undefined to match buildUpdatedRisk when applyMitigation is false. When mitigation exists but post min/max are missing (e.g. old DB), derive same defaults as buildUpdatedRisk (0 for min, ML for max) so dirty check does not false-positive. Pre-mitigation min/max use same defaults as buildUpdatedRisk (0 for min, Math.max(ML, min) for max) so undefined does not trigger a false dirty. */
  const normalizeRiskForComparison = useCallback((risk: Risk): Risk => {
    const toNum = (v: unknown): number | undefined =>
      typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" ? (Number.isFinite(Number(v)) ? Number(v) : undefined) : undefined;
    const toInt = (v: unknown): number | undefined => {
      const n = toNum(v);
      return n != null ? Math.floor(n) : undefined;
    };
    const hasMitigation = Boolean(risk.mitigation?.trim());
    const prePct = probabilityScaleToDisplayPct(risk.inherentRating.probability);
    const preCostML = risk.preMitigationCostML ?? 0;
    const preTimeML = risk.preMitigationTimeML ?? 0;
    const postPct = hasMitigation ? probabilityScaleToDisplayPct(risk.residualRating.probability) : undefined;
    const postCostML = hasMitigation ? (risk.postMitigationCostML ?? preCostML) : undefined;
    const postTimeML = hasMitigation ? (risk.postMitigationTimeML ?? preTimeML) : undefined;
    const applies = risk.appliesTo ?? "both";
    const preP = probabilityPctToScale(prePct);
    const preC = consequenceScaleFromAppliesTo(applies, preCostML, preTimeML);
    const inherentRating = buildRating(preP, preC);
    const residualRating =
      hasMitigation && postPct != null && postCostML != null && postTimeML != null
        ? buildRating(
            probabilityPctToScale(postPct),
            consequenceScaleFromAppliesTo(applies, postCostML, postTimeML)
          )
        : inherentRating;
    // When mitigation exists and we have post ML values, default missing post min/max to same as buildUpdatedRisk (0 for min, Math.max(ML, min) for max) so dirty check matches even when min > ML (partial data).
    const postCostMin =
      hasMitigation ? (risk.postMitigationCostMin ?? (postCostML != null ? 0 : undefined)) : undefined;
    const postCostMax =
      hasMitigation
        ? (risk.postMitigationCostMax ?? (postCostML != null ? Math.max(postCostML, postCostMin ?? 0) : undefined))
        : undefined;
    const postTimeMin =
      hasMitigation ? (risk.postMitigationTimeMin ?? (postTimeML != null ? 0 : undefined)) : undefined;
    const postTimeMax =
      hasMitigation
        ? (risk.postMitigationTimeMax ?? (postTimeML != null ? Math.max(postTimeML, postTimeMin ?? 0) : undefined))
        : undefined;
    // Apply same defaults as buildUpdatedRisk for pre-mitigation min/max (0 for min, Math.max(ML, min) for max) so dirty check does not false-positive when fields are undefined.
    const preCostMin = toNum(risk.preMitigationCostMin) ?? 0;
    const preCostMax = toNum(risk.preMitigationCostMax) ?? Math.max(preCostML, preCostMin);
    const preTimeMin = toInt(risk.preMitigationTimeMin) ?? 0;
    const preTimeMax = toInt(risk.preMitigationTimeMax) ?? Math.max(preTimeML, preTimeMin);
    return {
      ...risk,
      title: (risk.title ?? "").trim() || risk.title,
      description: risk.description?.trim() || undefined,
      category: risk.category,
      status: risk.status,
      owner: risk.owner?.trim() || undefined,
      appliesTo: applies,
      preMitigationCostMin: preCostMin,
      preMitigationCostML: preCostML ?? undefined,
      preMitigationCostMax: preCostMax,
      preMitigationTimeMin: preTimeMin,
      preMitigationTimeML: preTimeML ?? undefined,
      preMitigationTimeMax: preTimeMax,
      mitigation: hasMitigation ? (risk.mitigation?.trim() || undefined) : undefined,
      mitigationCost: hasMitigation ? (risk.mitigationCost ?? undefined) : undefined,
      postMitigationCostMin: postCostMin,
      postMitigationCostML: postCostML ?? undefined,
      postMitigationCostMax: postCostMax,
      postMitigationTimeMin: postTimeMin,
      postMitigationTimeML: postTimeML ?? undefined,
      postMitigationTimeMax: postTimeMax,
      inherentRating,
      residualRating,
      probability: (hasMitigation && postPct != null ? postPct : prePct) / 100,
      updatedAt: "",
    };
  }, []);

  // Sync form when the risk we're viewing changes (e.g. open modal or switch risk). Ref guard avoids re-syncing when only currentRisk reference changed (same id). Deps use currentRisk?.id so effect runs only when id/index change, not on object reference change.
  useEffect(() => {
    if (!open || !currentRisk || currentIndex === risks.length) return;
    if (lastSyncedRiskIdRef.current === currentRisk.id) return;
    syncFormFromRisk(currentRisk);
    lastSyncedRiskIdRef.current = currentRisk.id;
    lastSyncedBaselineRef.current = toComparableSnapshot(
      normalizeRiskForComparison(currentRisk) as Record<string, unknown>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentRisk?.id intentionally used instead of currentRisk to avoid re-runs on same-risk reference change
  }, [currentIndex, open, currentRisk?.id, risks.length, syncFormFromRisk, normalizeRiskForComparison]);

  // Clear "just saved" state when switching to a different risk so we don't suppress the dirty prompt for the wrong risk. Deps use currentRisk?.id so we only re-run when the viewed risk id changes, not on object reference change.
  useEffect(() => {
    if (!currentRisk) return;
    if (prevRiskIdRef.current != null && prevRiskIdRef.current !== currentRisk.id) {
      lastSavedSnapshotRef.current = null;
    }
    prevRiskIdRef.current = currentRisk.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depend on id only; currentRisk read from closure when effect runs
  }, [currentRisk?.id]);

  // Clear validation errors when switching risk or when modal opens
  useEffect(() => {
    if (open) setValidationErrors([]);
  }, [open, currentIndex]);

  // When filter narrows and current index is out of range, jump to first
  useEffect(() => {
    if (!open || risks.length === 0) return;
    if (currentIndex >= risks.length) setCurrentIndex(0);
  }, [open, risks.length, currentIndex]);

  // When risks array changes while modal is open (e.g. risksForDetailModal flips from [initialRisk, ...filtered] to filteredRisks),
  // keep showing the same risk by id instead of the same index, so we don't jump to a different risk.
  useEffect(() => {
    if (!open || risks.length === 0) return;
    if (currentIndex === risks.length) return; // on add-new slot
    const viewingId = lastSyncedRiskIdRef.current;
    if (!viewingId) return;
    const newIndex = risks.findIndex((r) => r.id === viewingId);
    if (newIndex >= 0) {
      setCurrentIndex(newIndex);
    } else {
      setCurrentIndex(0);
    }
  }, [open, risks, currentIndex]);

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

  /** Build the risk as it would be saved from current form state (for dirty check and save). When applyMitigation is false, residual = inherent and no mitigation fields. Derives min/max from ML when form leaves them empty so saved risk always passes runnable validation. */
  const buildUpdatedRisk = useCallback((): Risk | null => {
    if (!currentRisk) return null;
    const prePct = parseNum(preMitigationProbabilityPct) ?? 50;
    const preCostML = parseNum(preMitigationCostML) ?? 0;
    const preTimeML = parseIntNum(preMitigationTimeML) ?? 0;
    const applies = appliesTo;
    const preP = probabilityPctToScale(prePct);
    const preC = consequenceScaleFromAppliesTo(applies, preCostML, preTimeML);
    const inherentRating = buildRating(preP, preC);
    const postPct = applyMitigation ? (parseNum(postMitigationProbabilityPct) ?? 50) : prePct;
    const postCostML = applyMitigation ? (parseNum(postMitigationCostML) ?? preCostML) : preCostML;
    const postTimeML = applyMitigation ? (parseIntNum(postMitigationTimeML) ?? preTimeML) : preTimeML;
    const postP = probabilityPctToScale(postPct);
    const postC = consequenceScaleFromAppliesTo(applies, postCostML, postTimeML);
    const residualRating = buildRating(postP, postC);
    const preCostMin = parseNum(preMitigationCostMin) ?? 0;
    const preCostMax = parseNum(preMitigationCostMax) ?? Math.max(preCostML, preCostMin);
    const preTimeMin = parseIntNum(preMitigationTimeMin) ?? 0;
    const preTimeMax = parseIntNum(preMitigationTimeMax) ?? Math.max(preTimeML, preTimeMin);
    const postCostMin = applyMitigation ? (parseNum(postMitigationCostMin) ?? 0) : undefined;
    const postCostMax = applyMitigation ? (parseNum(postMitigationCostMax) ?? Math.max(postCostML, postCostMin ?? 0)) : undefined;
    const postTimeMin = applyMitigation ? (parseIntNum(postMitigationTimeMin) ?? 0) : undefined;
    const postTimeMax = applyMitigation ? (parseIntNum(postMitigationTimeMax) ?? Math.max(postTimeML, postTimeMin ?? 0)) : undefined;
    const catTrim = (category ?? "").trim();
    const categoryOut =
      catTrim !== "" ? catTrim : isRiskStatusDraft(status) ? "" : currentRisk.category;
    return {
      ...currentRisk,
      riskNumber: currentRisk.riskNumber,
      title: (title ?? "").trim() || currentRisk.title,
      description: (description ?? "").trim() || undefined,
      category: categoryOut,
      status,
      owner: getResolvedOwnerPickerValue(ownerSelect, ownerNewDraft) || undefined,
      appliesTo: applies,
      preMitigationCostMin: preCostMin,
      preMitigationCostML: preCostML ?? undefined,
      preMitigationCostMax: preCostMax,
      preMitigationTimeMin: preTimeMin,
      preMitigationTimeML: preTimeML ?? undefined,
      preMitigationTimeMax: preTimeMax,
      mitigation: applyMitigation ? ((mitigation ?? "").trim() || undefined) : undefined,
      mitigationCost: applyMitigation ? (parseNum(mitigationCost) ?? undefined) : undefined,
      postMitigationCostMin: postCostMin,
      postMitigationCostML: applyMitigation ? (postCostML ?? undefined) : undefined,
      postMitigationCostMax: postCostMax,
      postMitigationTimeMin: postTimeMin,
      postMitigationTimeML: applyMitigation ? (postTimeML ?? undefined) : undefined,
      postMitigationTimeMax: postTimeMax,
      inherentRating,
      residualRating,
      probability: (applyMitigation ? postPct : prePct) / 100,
      updatedAt: nowIso(),
    };
  }, [
    currentRisk,
    title,
    description,
    category,
    status,
    ownerSelect,
    ownerNewDraft,
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

  const [isDirtyState, setIsDirtyState] = useState(false);
  const isDirtyCancelledRef = useRef(false);
  useEffect(() => {
    isDirtyCancelledRef.current = false;
    const update = () => {
      if (isDirtyCancelledRef.current) return;
      if (!currentRisk || currentIndex === risks.length) {
        setIsDirtyState(false);
        return;
      }
      if (lastSyncedRiskIdRef.current !== currentRisk.id) {
        setIsDirtyState(false);
        return;
      }
      const updated = buildUpdatedRisk();
      if (!updated) {
        setIsDirtyState(false);
        return;
      }
      const currentSnapshot = toComparableSnapshot(updated as Record<string, unknown>);
      if (
        lastSavedSnapshotRef.current?.id === currentRisk.id &&
        lastSavedSnapshotRef.current.snapshot === currentSnapshot
      ) {
        setIsDirtyState(false);
        return;
      }
      const baseline = lastSyncedBaselineRef.current;
      if (baseline == null) {
        setIsDirtyState(false);
        return;
      }
      setIsDirtyState(currentSnapshot !== baseline);
    };
    update();
    return () => {
      isDirtyCancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depend on currentRisk?.id to avoid re-runs on same-risk reference change; currentRisk read from closure
  }, [currentRisk?.id, currentIndex, risks.length, buildUpdatedRisk]);

  const isDirty = isDirtyState;

  const [pendingNav, setPendingNav] = useState<"prev" | "next" | "close" | "generateAI" | null>(null);
  const showSavePrompt = pendingNav !== null && !readOnly;

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (readOnly) return false;
    const updated = buildUpdatedRisk();
    if (!updated) return false;
    const errors = validateNonDraftRisk({
      status,
      applyMitigation,
      title,
      description,
      category,
      ownerSelect,
      ownerNewDraft,
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
    const ownerResolved = getResolvedOwnerPickerValue(ownerSelect, ownerNewDraft);
    if (shouldPersistNewOwnerOnSubmit(ownerSelect) && ownerResolved) {
      try {
        await createProjectOwner(ownerResolved);
      } catch (err) {
        setValidationErrors([
          err instanceof Error ? err.message : "Could not save new owner. Try again.",
        ]);
        return false;
      }
    }
    setValidationErrors([]);
    dlog("[risk save] detail modal", {
      category: updated.category,
      status: updated.status,
      appliesTo: updated.appliesTo,
      owner: updated.owner,
    });
    onSave(updated);
    // Mark form as "just saved" so isDirty is false until user edits or switches risk; sync form and update baseline
    if (currentRisk) {
      const snapshot = toComparableSnapshot(updated as Record<string, unknown>);
      lastSavedSnapshotRef.current = { id: currentRisk.id, snapshot };
      lastSyncedBaselineRef.current = snapshot;
      syncFormFromRisk(updated);
    }
    return true;
  }, [
    readOnly,
    buildUpdatedRisk,
    currentRisk,
    onSave,
    syncFormFromRisk,
    status,
    title,
    description,
    category,
    ownerSelect,
    ownerNewDraft,
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
    createProjectOwner,
  ]);

  const handleArchiveRiskAction = useCallback(() => {
    if (!currentRisk || isAddNewSlot || isRiskStatusArchived(currentRisk.status)) return;
    onArchiveRisk?.(currentRisk.id);
    onClose();
  }, [currentRisk, isAddNewSlot, onArchiveRisk, onClose]);

  const handleRestoreRiskAction = useCallback(() => {
    if (!currentRisk || isAddNewSlot || !isRiskStatusArchived(currentRisk.status)) return;
    onRestoreRisk?.(currentRisk.id);
    onClose();
  }, [currentRisk, isAddNewSlot, onRestoreRisk, onClose]);

  const handleSaveThenNav = useCallback(() => {
    if (pendingNav === null) return;
    const nav = pendingNav;
    void (async () => {
      if (!(await handleSave())) return;
      if (nav === "prev" && currentIndex > 0) setCurrentIndex((i) => i - 1);
      else if (nav === "next" && currentIndex < risks.length) setCurrentIndex((i) => i + 1);
      else if (nav === "close") onClose();
      else if (nav === "generateAI") onAddNewWithAI?.();
      setPendingNav(null);
    })();
  }, [pendingNav, handleSave, currentIndex, risks.length, onClose, onAddNewWithAI]);

  const handleDiscardThenNav = useCallback(() => {
    if (pendingNav === null) return;
    if (pendingNav === "prev" && currentIndex > 0) setCurrentIndex((i) => i - 1);
    else if (pendingNav === "next" && currentIndex < risks.length) setCurrentIndex((i) => i + 1);
    else if (pendingNav === "close") onClose();
    else if (pendingNav === "generateAI") onAddNewWithAI?.();
    setPendingNav(null);
  }, [pendingNav, currentIndex, risks.length, onClose, onAddNewWithAI]);

  const handleCancelNav = useCallback(() => setPendingNav(null), []);

  const requestGenerateAI = useCallback(() => {
    if (readOnly) return;
    if (isDirty && currentRisk && currentIndex !== risks.length) {
      setPendingNav("generateAI");
      return;
    }
    onAddNewWithAI?.();
  }, [readOnly, isDirty, currentRisk, currentIndex, risks.length, onAddNewWithAI]);

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
        className="w-full max-w-[70vw] max-h-[90vh] min-h-[400px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-2xl flex flex-col overflow-hidden outline-none"
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
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="w-14 shrink-0 text-lg font-semibold text-[var(--foreground)]"
                  aria-label="Risk ID"
                >
                  {currentRisk.riskNumber != null ? String(currentRisk.riskNumber).padStart(3, "0") : currentRisk.id}
                </span>
                <input
                  type="text"
                  value={title}
                  readOnly={readOnly}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 min-w-0 text-lg font-semibold text-[var(--foreground)] bg-transparent border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-neutral-300 dark:focus:border-neutral-600"
                  aria-label="Risk title"
                  id="risk-detail-dialog-title"
                />
                {isRiskStatusArchived(currentRisk.status) && (
                  <span
                    className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-md bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200"
                    aria-label="Archived risk"
                  >
                    Archived
                  </span>
                )}
              </div>
            ) : null}
          </div>
          {hasMultipleOrAddNew && !isAddNewSlot && (
            <div className="flex items-center gap-2 shrink-0">
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
                disabled={currentIndex === risks.length || (isLast && !hasAddNewSlot)}
                className={btnSecondary}
                aria-label="Next risk"
              >
                Next
              </button>
            </div>
          )}
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
          {readOnly && (
            <div
              className="mb-4 shrink-0 rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300"
              role="status"
            >
              View-only access. Editing is disabled.
            </div>
          )}
          {isEmpty || isAddNewSlot ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center text-neutral-600 dark:text-neutral-400">
              <p className="mb-6">
                {isAddNewSlot ? "Add a new risk to the register." : "There are no risks to review."}
              </p>
              {!readOnly && (onAddNewWithFile != null || onAddNewWithAI != null) ? (
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
              ) : !readOnly && onAddNew ? (
                <button type="button" onClick={onAddNew} className={btnPrimary}>
                  {isAddNewSlot ? "Add new risk" : "Create new risk"}
                </button>
              ) : null}
            </div>
          ) : (
            currentRisk && (
              <div className={`space-y-6 ${readOnly ? "pointer-events-none select-text" : ""}`}>
                {(() => {
                  const runnableErrors = getRiskValidationErrors(currentRisk);
                  return runnableErrors.length > 0 ? (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" role="status">
                      <p className="font-medium mb-1">Fix these to run simulation:</p>
                      <ul className="list-disc list-inside">{runnableErrors.map((e) => <li key={e}>{e}</li>)}</ul>
                    </div>
                  ) : null;
                })()}
                {validationErrors.length > 0 && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200" role="alert">
                    <p className="font-medium mb-1">Complete all required fields before saving (non-draft risks):</p>
                    <ul className="list-disc list-inside">{validationErrors.map((e) => <li key={e}>{e}</li>)}</ul>
                  </div>
                )}
                {/* General */}
                <section>
                  <div className="space-y-3">
                    {isRiskStatusDraft(status) && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                        This risk is in draft. Change status to Open and save to include it in simulation.
                      </p>
                    )}
                    <div>
                      <label htmlFor="detail-description" className={labelClass}>
                        Description {!isRiskStatusDraft(status) && <span className="text-red-500" aria-label="required">*</span>}
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
                          Category {!isRiskStatusDraft(status) && <span className="text-red-500" aria-label="required">*</span>}
                        </label>
                        <RiskCategorySelect
                          id="detail-category"
                          value={category}
                          onChange={setCategory}
                          className={selectClass}
                          allowEmptyPlaceholder
                        />
                      </div>
                      <div>
                        <label htmlFor="detail-owner" className={labelClass}>
                          Owner {!isRiskStatusDraft(status) && <span className="text-red-500" aria-label="required">*</span>}
                        </label>
                        <RiskOwnerPicker
                          id="detail-owner"
                          selectValue={ownerSelect}
                          newNameDraft={ownerNewDraft}
                          onSelectChange={setOwnerSelect}
                          onNewNameDraftChange={setOwnerNewDraft}
                          className={selectClass}
                          allowEmptyPlaceholder
                        />
                      </div>
                      <div>
                        <label htmlFor="detail-status" className={labelClass}>
                          Status {!isRiskStatusDraft(status) && <span className="text-red-500" aria-label="required">*</span>}
                        </label>
                        <RiskStatusSelect
                          id="detail-status"
                          value={status}
                          onChange={setStatus}
                          className={selectClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="detail-applies-to" className={labelClass}>
                          Applies To {!isRiskStatusDraft(status) && <span className="text-red-500" aria-label="required">*</span>}
                        </label>
                        <RiskAppliesToSelect
                          id="detail-applies-to"
                          value={appliesTo}
                          onChange={setAppliesTo}
                          className={selectClass}
                        />
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
                        Probability % {!isRiskStatusDraft(status) && <span className="text-red-500" aria-label="required">*</span>}
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
                        <label htmlFor="detail-pre-cost-min" className={labelClass}>Cost Min ($) {(!isRiskStatusDraft(status) && appliesToAffectsCost(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-cost-min" type="text" inputMode="numeric" value={formatCostDisplay(preMitigationCostMin)} onChange={(e) => setPreMitigationCostMin(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-pre-cost-ml" className={labelClass}>Cost Most Likely ($) {(!isRiskStatusDraft(status) && appliesToAffectsCost(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-cost-ml" type="text" inputMode="numeric" value={formatCostDisplay(preMitigationCostML)} onChange={(e) => setPreMitigationCostML(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-pre-cost-max" className={labelClass}>Cost Max ($) {(!isRiskStatusDraft(status) && appliesToAffectsCost(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-cost-max" type="text" inputMode="numeric" value={formatCostDisplay(preMitigationCostMax)} onChange={(e) => setPreMitigationCostMax(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="detail-pre-time-min" className={labelClass}>Time Min (days) {(!isRiskStatusDraft(status) && appliesToAffectsTime(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-time-min" type="number" min={0} step={1} value={preMitigationTimeMin} onChange={(e) => setPreMitigationTimeMin(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-pre-time-ml" className={labelClass}>Time ML (days) {(!isRiskStatusDraft(status) && appliesToAffectsTime(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-pre-time-ml" type="number" min={0} step={1} value={preMitigationTimeML} onChange={(e) => setPreMitigationTimeML(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-pre-time-max" className={labelClass}>Time Max (days) {(!isRiskStatusDraft(status) && appliesToAffectsTime(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
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
                        Description {!isRiskStatusDraft(status) && <span className="text-red-500" aria-label="required">*</span>}
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
                        Probability % {!isRiskStatusDraft(status) && <span className="text-red-500" aria-label="required">*</span>}
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
                        <label htmlFor="detail-post-cost-min" className={labelClass}>Cost Min ($) {(!isRiskStatusDraft(status) && appliesToAffectsCost(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-cost-min" type="text" inputMode="numeric" value={formatCostDisplay(postMitigationCostMin)} onChange={(e) => setPostMitigationCostMin(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-post-cost-ml" className={labelClass}>Cost Most Likely ($) {(!isRiskStatusDraft(status) && appliesToAffectsCost(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-cost-ml" type="text" inputMode="numeric" value={formatCostDisplay(postMitigationCostML)} onChange={(e) => setPostMitigationCostML(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-post-cost-max" className={labelClass}>Cost Max ($) {(!isRiskStatusDraft(status) && appliesToAffectsCost(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-cost-max" type="text" inputMode="numeric" value={formatCostDisplay(postMitigationCostMax)} onChange={(e) => setPostMitigationCostMax(parseCostInput(e.target.value))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="detail-post-time-min" className={labelClass}>Time Min (days) {(!isRiskStatusDraft(status) && appliesToAffectsTime(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-time-min" type="number" min={0} step={1} value={postMitigationTimeMin} onChange={(e) => setPostMitigationTimeMin(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-post-time-ml" className={labelClass}>Time ML (days) {(!isRiskStatusDraft(status) && appliesToAffectsTime(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
                        <input id="detail-post-time-ml" type="number" min={0} step={1} value={postMitigationTimeML} onChange={(e) => setPostMitigationTimeML(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="detail-post-time-max" className={labelClass}>Time Max (days) {(!isRiskStatusDraft(status) && appliesToAffectsTime(appliesTo)) && <span className="text-red-500" aria-label="required">*</span>}</label>
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

        {(!isEmpty || isAddNewSlot) && !readOnly && (
          <div className="flex flex-wrap justify-between items-center gap-3 shrink-0 px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-[var(--background)]">
            <div className="flex gap-2">
              {onAddNewWithAI && (
                <button type="button" onClick={requestGenerateAI} className={btnSecondary} aria-label="Generate AI Risk">
                  Generate AI Risk
                </button>
              )}
              {isAddNewSlot && onAddNew && onAddNewWithFile == null && onAddNewWithAI == null && (
                <button type="button" onClick={onAddNew} className={btnPrimary}>
                  Add new risk
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 ml-auto items-center justify-end">
              {!isAddNewSlot && currentRisk && onArchiveRisk && !isRiskStatusArchived(currentRisk.status) && (
                <button
                  type="button"
                  onClick={handleArchiveRiskAction}
                  className={btnDangerOutline}
                  aria-label="Archive risk — move to archived list"
                >
                  Archive risk
                </button>
              )}
              {!isAddNewSlot && currentRisk && onRestoreRisk && isRiskStatusArchived(currentRisk.status) && (
                <button
                  type="button"
                  onClick={handleRestoreRiskAction}
                  className={btnPrimary}
                  aria-label="Restore risk to Open status"
                >
                  Restore to Open
                </button>
              )}
              {!isAddNewSlot && (
                <button type="button" onClick={() => void handleSave()} className={btnPrimary}>
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
