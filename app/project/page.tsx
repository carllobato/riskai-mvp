"use client";

/**
 * Project Settings page: define baseline project context used to interpret risk outputs.
 * Data is persisted in localStorage under key "riskai_project_context_v1" (see src/lib/projectContext.ts).
 * Optional server sync: POST /api/project-context (same style as simulation-context).
 */

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  type ProjectContext,
  type RiskAppetite,
  type ProjectCurrency,
  type FinancialUnit,
  loadProjectContext,
  saveProjectContext,
  clearProjectContext,
  parseProjectContext,
  getContingencyPercent,
  formatMoneyMillions,
  computeValueM,
} from "@/lib/projectContext";
import { ProjectExcelUploadSection } from "@/components/project/ProjectExcelUploadSection";

const CogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const RISK_APPETITE_OPTIONS: { value: RiskAppetite; label: string }[] = [
  { value: "P10", label: "P10" },
  { value: "P20", label: "P20" },
  { value: "P30", label: "P30" },
  { value: "P40", label: "P40" },
  { value: "P50", label: "P50" },
  { value: "P60", label: "P60" },
  { value: "P70", label: "P70" },
  { value: "P80", label: "P80" },
  { value: "P90", label: "P90" },
];

const CURRENCY_OPTIONS: { value: ProjectCurrency; label: string }[] = [
  { value: "AUD", label: "AUD" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
];

const FINANCIAL_UNIT_OPTIONS: { value: FinancialUnit; label: string }[] = [
  { value: "THOUSANDS", label: "Thousands ($k)" },
  { value: "MILLIONS", label: "Millions ($m)" },
  { value: "BILLIONS", label: "Billions ($b)" },
];

const MAX_MONTHS = 600;
const MAX_WEEKS = 520;

const REQUIRED_NUMERIC_KEYS = [
  "contingencyValue_input",
  "plannedDuration_months",
  "scheduleContingency_weeks",
] as const;

type RawNumericFields = Partial<Record<(typeof REQUIRED_NUMERIC_KEYS)[number], string>>;

function defaultContext(): ProjectContext {
  return {
    projectName: "",
    location: "",
    plannedDuration_months: 0,
    targetCompletionDate: "",
    scheduleContingency_weeks: 0,
    riskAppetite: "P80",
    currency: "AUD",
    financialUnit: "MILLIONS",
    projectValue_input: 0,
    contingencyValue_input: 0,
    projectValue_m: 0,
    contingencyValue_m: 0,
    approvedBudget_m: 0,
  };
}

function getValidationErrors(
  form: ProjectContext,
  rawNumeric: RawNumericFields
): Record<string, string> {
  const err: Record<string, string> = {};
  if (!form.projectName.trim()) err.projectName = "This field is required";
  if (form.projectValue_input <= 0)
    err.projectValue_input = form.projectValue_input < 0 ? "Enter a valid number" : "This field is required";
  // Required numeric fields: must not be empty and must be >= 0 (and within range for duration/schedule)
  const rawCv = rawNumeric.contingencyValue_input ?? (form.contingencyValue_input === 0 ? "" : String(form.contingencyValue_input));
  if (rawCv === "") err.contingencyValue_input = "This field is required";
  else {
    const n = Number(rawCv);
    if (Number.isNaN(n) || n < 0) err.contingencyValue_input = "Enter a valid number";
  }
  const rawDur = rawNumeric.plannedDuration_months ?? (form.plannedDuration_months === 0 ? "" : String(form.plannedDuration_months));
  if (rawDur === "") err.plannedDuration_months = "This field is required";
  else {
    const n = Number(rawDur);
    if (Number.isNaN(n) || n < 0) err.plannedDuration_months = "Enter a valid number";
    else if (n > MAX_MONTHS) err.plannedDuration_months = `Duration must be between 0 and ${MAX_MONTHS} months.`;
  }
  if (!form.targetCompletionDate.trim()) err.targetCompletionDate = "This field is required";
  const rawSc = rawNumeric.scheduleContingency_weeks ?? (form.scheduleContingency_weeks === 0 ? "" : String(form.scheduleContingency_weeks));
  if (rawSc === "") err.scheduleContingency_weeks = "This field is required";
  else {
    const n = Number(rawSc);
    if (Number.isNaN(n) || n < 0) err.scheduleContingency_weeks = "Enter a valid number";
    else if (n > MAX_WEEKS) err.scheduleContingency_weeks = `Schedule contingency must be between 0 and ${MAX_WEEKS} weeks.`;
  }
  return err;
}

const FIRST_INVALID_FIELD_ORDER = [
  "projectName",
  "projectValue_input",
  "contingencyValue_input",
  "plannedDuration_months",
  "targetCompletionDate",
  "scheduleContingency_weeks",
] as const;


const SAVED_CONFIRM_AUTO_HIDE_MS = 3000;

export default function ProjectInformationPage() {
  const [form, setForm] = useState<ProjectContext>(defaultContext);
  const [rawNumericFields, setRawNumericFields] = useState<RawNumericFields>({});
  const [saved, setSaved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const savedHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const projectValueRef = useRef<HTMLInputElement>(null);
  const contingencyValueRef = useRef<HTMLInputElement>(null);
  const plannedDurationRef = useRef<HTMLInputElement>(null);
  const targetCompletionDateRef = useRef<HTMLInputElement>(null);
  const scheduleContingencyRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Record<string, RefObject<HTMLInputElement | null>> = {
    projectName: projectNameRef,
    projectValue_input: projectValueRef,
    contingencyValue_input: contingencyValueRef,
    plannedDuration_months: plannedDurationRef,
    targetCompletionDate: targetCompletionDateRef,
    scheduleContingency_weeks: scheduleContingencyRef,
  };

  const loadStored = useCallback(() => {
    const stored = loadProjectContext();
    if (stored) {
      setForm(stored);
      setRawNumericFields({
        contingencyValue_input: stored.contingencyValue_input === 0 ? "" : String(stored.contingencyValue_input),
        plannedDuration_months: stored.plannedDuration_months === 0 ? "" : String(stored.plannedDuration_months),
        scheduleContingency_weeks: stored.scheduleContingency_weeks === 0 ? "" : String(stored.scheduleContingency_weeks),
      });
    }
  }, []);

  useEffect(() => {
    loadStored();
  }, [loadStored]);

  useEffect(() => {
    return () => {
      if (savedHideTimeoutRef.current) clearTimeout(savedHideTimeoutRef.current);
    };
  }, []);

  const update = useCallback(
    <K extends keyof ProjectContext>(key: K, value: ProjectContext[K], raw?: string) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        const unit = key === "financialUnit" ? (value as FinancialUnit) : prev.financialUnit;
        const pvInput = key === "projectValue_input" ? (value as number) : prev.projectValue_input;
        const cvInput = key === "contingencyValue_input" ? (value as number) : prev.contingencyValue_input;
        if (
          key === "projectValue_input" ||
          key === "contingencyValue_input" ||
          key === "financialUnit"
        ) {
          next.projectValue_m = computeValueM(pvInput, unit);
          next.contingencyValue_m = computeValueM(cvInput, unit);
          next.approvedBudget_m = next.projectValue_m + next.contingencyValue_m;
        }
        return next;
      });
      if (raw !== undefined && REQUIRED_NUMERIC_KEYS.includes(key as (typeof REQUIRED_NUMERIC_KEYS)[number])) {
        setRawNumericFields((prev) => ({ ...prev, [key]: raw }));
      }
      setValidation((prev) => ({ ...prev, [key]: "" }));
      if (saved) setSaved(false);
    },
    [saved]
  );

  const validationErrors = getValidationErrors(form, rawNumericFields);
  const isFormValid = Object.keys(validationErrors).length === 0;

  const onSave = useCallback(() => {
    const err = getValidationErrors(form, rawNumericFields);
    setValidation(err);
    if (Object.keys(err).length > 0) {
      const firstKey = FIRST_INVALID_FIELD_ORDER.find((k) => err[k]);
      const ref = firstKey ? fieldRefs[firstKey]?.current : null;
      ref?.scrollIntoView({ behavior: "smooth", block: "center" });
      ref?.focus();
      return;
    }
    const parsed = parseProjectContext(form);
    if (!parsed) return;
    const toSave: ProjectContext = parsed;
    const ok = saveProjectContext(toSave);
    if (ok) {
      setForm(toSave);
      setRawNumericFields({
        contingencyValue_input: toSave.contingencyValue_input === 0 ? "" : String(toSave.contingencyValue_input),
        plannedDuration_months: toSave.plannedDuration_months === 0 ? "" : String(toSave.plannedDuration_months),
        scheduleContingency_weeks: toSave.scheduleContingency_weeks === 0 ? "" : String(toSave.scheduleContingency_weeks),
      });
      setSaved(true);
      if (savedHideTimeoutRef.current) clearTimeout(savedHideTimeoutRef.current);
      savedHideTimeoutRef.current = setTimeout(() => {
        setSaved(false);
        savedHideTimeoutRef.current = null;
      }, SAVED_CONFIRM_AUTO_HIDE_MS);
      fetch("/api/project-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      }).catch(() => {});
    }
  }, [form, rawNumericFields]);

  const onClear = useCallback(() => {
    setShowClearConfirm(false);
    clearProjectContext();
    setForm(defaultContext());
    setRawNumericFields({});
    setSaved(false);
    setValidation({});
  }, []);

  const contingencyPct = getContingencyPercent(form);
  const approvedBudgetInUnit =
    form.projectValue_input + form.contingencyValue_input;
  const showEquivalentInM = form.financialUnit !== "MILLIONS";

  const cardClass =
    "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 sm:p-5";
  const labelClass = "block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1";
  const inputClass =
    "w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 h-10";
  const inputErrorClass =
    "w-full rounded-md border-2 border-red-500 dark:border-red-400 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 h-10";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
        <CogIcon />
        Project Settings
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        Define the baseline project context used to interpret risk outputs.
      </p>

      {/* 1) Project Details */}
      <section className={cardClass + " mb-4"}>
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2">
          Project Details
        </h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="projectName" className={labelClass}>
              Project name <span className="text-red-500">*</span>
            </label>
            <input
              ref={projectNameRef}
              id="projectName"
              type="text"
              value={form.projectName}
              onChange={(e) => update("projectName", e.target.value)}
              className={validation.projectName ? inputErrorClass : inputClass}
              placeholder="e.g. Northgate Rail Upgrade"
            />
            {validation.projectName && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validation.projectName}</p>
            )}
          </div>
          <div>
            <label htmlFor="location" className={labelClass}>
              Location (optional)
            </label>
            <input
              id="location"
              type="text"
              value={form.location ?? ""}
              onChange={(e) => update("location", e.target.value)}
              className={inputClass}
              placeholder="e.g. Sydney, NSW"
            />
          </div>
          <div>
            <label htmlFor="currency" className={labelClass}>
              Currency
            </label>
            <select
              id="currency"
              value={form.currency}
              onChange={(e) => update("currency", e.target.value as ProjectCurrency)}
              className={inputClass}
              aria-label="Currency"
            >
              {CURRENCY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 2) Financial Context */}
      <section className={cardClass + " mb-4"}>
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2">
          Financial Context
        </h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="financialUnit" className={labelClass}>
              Unit
            </label>
            <select
              id="financialUnit"
              value={form.financialUnit}
              onChange={(e) => update("financialUnit", e.target.value as FinancialUnit)}
              className={inputClass}
              aria-label="Financial unit"
            >
              {FINANCIAL_UNIT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="projectValue_input" className={labelClass}>
              Project Value (in selected unit) <span className="text-red-500">*</span>
            </label>
            <input
              ref={projectValueRef}
              id="projectValue_input"
              type="number"
              min={0}
              step={form.financialUnit === "BILLIONS" || form.financialUnit === "MILLIONS" ? 0.1 : 1}
              value={form.projectValue_input === 0 ? "" : form.projectValue_input}
              onChange={(e) =>
                update("projectValue_input", e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))
              }
              className={validation.projectValue_input ? inputErrorClass : inputClass}
              placeholder={form.financialUnit === "BILLIONS" ? "e.g. 2.5" : form.financialUnit === "MILLIONS" ? "e.g. 217" : "e.g. 500000"}
            />
            {validation.projectValue_input && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validation.projectValue_input}</p>
            )}
          </div>
          <div>
            <label htmlFor="contingencyValue_input" className={labelClass}>
              Contingency Value (in selected unit) <span className="text-red-500">*</span>
            </label>
            <input
              ref={contingencyValueRef}
              id="contingencyValue_input"
              type="number"
              min={0}
              step={form.financialUnit === "BILLIONS" || form.financialUnit === "MILLIONS" ? 0.1 : 1}
              value={rawNumericFields.contingencyValue_input ?? (form.contingencyValue_input === 0 ? "" : String(form.contingencyValue_input))}
              onChange={(e) => {
                const raw = e.target.value;
                const num = Number(raw);
                const safe = raw === "" ? 0 : (Number.isFinite(num) ? Math.max(0, num) : 0);
                update("contingencyValue_input", safe, raw);
              }}
              className={validation.contingencyValue_input ? inputErrorClass : inputClass}
              placeholder={form.financialUnit === "BILLIONS" ? "e.g. 0.25" : form.financialUnit === "MILLIONS" ? "e.g. 22" : "e.g. 50000"}
            />
            {validation.contingencyValue_input && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validation.contingencyValue_input}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          Risks remain at face value; unit only affects project context.
        </p>
        <div className="mt-3 rounded border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
          <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">Derived</p>
          <p>
            Contingency %: {contingencyPct != null ? `${contingencyPct.toFixed(1)}%` : "—"} · Approved budget (in selected unit): {approvedBudgetInUnit}
          </p>
          {showEquivalentInM && (
            <p className="mt-1">
              Equivalent in $m: Project value = {formatMoneyMillions(form.projectValue_m)} · Contingency = {formatMoneyMillions(form.contingencyValue_m)} · Approved budget = {formatMoneyMillions(form.approvedBudget_m)}
            </p>
          )}
        </div>
      </section>

      {/* 3) Schedule Context */}
      <section className={cardClass + " mb-4"}>
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2">
          Schedule Context
        </h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="plannedDuration_months" className={labelClass}>
              Planned duration (months) <span className="text-red-500">*</span>
            </label>
            <input
              ref={plannedDurationRef}
              id="plannedDuration_months"
              type="number"
              min={0}
              max={MAX_MONTHS}
              step={1}
              value={rawNumericFields.plannedDuration_months ?? (form.plannedDuration_months === 0 ? "" : String(form.plannedDuration_months))}
              onChange={(e) => {
                const raw = e.target.value;
                const num = Number(raw);
                const safe = raw === "" ? 0 : (Number.isFinite(num) ? Math.max(0, Math.min(MAX_MONTHS, Math.floor(num))) : 0);
                update("plannedDuration_months", safe, raw);
              }}
              className={validation.plannedDuration_months ? inputErrorClass : inputClass}
              placeholder="e.g. 24"
            />
            {validation.plannedDuration_months && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validation.plannedDuration_months}</p>
            )}
          </div>
          <div>
            <label htmlFor="targetCompletionDate" className={labelClass}>
              Target completion date <span className="text-red-500">*</span>
            </label>
            <input
              ref={targetCompletionDateRef}
              id="targetCompletionDate"
              type="date"
              value={form.targetCompletionDate}
              onChange={(e) => update("targetCompletionDate", e.target.value)}
              className={validation.targetCompletionDate ? inputErrorClass : inputClass}
            />
            {validation.targetCompletionDate && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validation.targetCompletionDate}</p>
            )}
          </div>
          <div>
            <label htmlFor="scheduleContingency_weeks" className={labelClass}>
              Schedule contingency (weeks) <span className="text-red-500">*</span>
            </label>
            <input
              ref={scheduleContingencyRef}
              id="scheduleContingency_weeks"
              type="number"
              min={0}
              max={MAX_WEEKS}
              step={1}
              value={rawNumericFields.scheduleContingency_weeks ?? (form.scheduleContingency_weeks === 0 ? "" : String(form.scheduleContingency_weeks))}
              onChange={(e) => {
                const raw = e.target.value;
                const num = Number(raw);
                const safe = raw === "" ? 0 : (Number.isFinite(num) ? Math.max(0, Math.min(MAX_WEEKS, Math.floor(num))) : 0);
                update("scheduleContingency_weeks", safe, raw);
              }}
              className={validation.scheduleContingency_weeks ? inputErrorClass : inputClass}
              placeholder="e.g. 4"
            />
            {validation.scheduleContingency_weeks && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validation.scheduleContingency_weeks}</p>
            )}
          </div>
        </div>
      </section>

      {/* 4) Risk Appetite */}
      <section className={cardClass + " mb-4"}>
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2">
          Risk Appetite
        </h2>
        <div
          className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5"
          role="group"
          aria-label="Risk appetite"
        >
          {RISK_APPETITE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => update("riskAppetite", value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                form.riskAppetite === value
                  ? "bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)] shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 5) Risk Register Files (Excel) - upload only here; list disappears when leaving page */}
      <ProjectExcelUploadSection />

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button
          type="button"
          onClick={onSave}
          disabled={!isFormValid}
          className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50"
        >
          Save Project Context
        </button>
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Clear
        </button>
      </div>
      {saved && (
        <div
          className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-200"
          role="status"
        >
          Saved ✓ Project context updated.{" "}
          <Link href="/risk-register" className="underline underline-offset-2 hover:no-underline font-medium">
            Continue to Risk Register →
          </Link>
        </div>
      )}

      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-dialog-title"
        >
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-5 max-w-sm shadow-lg">
            <h2 id="clear-dialog-title" className="text-base font-semibold text-[var(--foreground)] mb-2">
              Clear project context?
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              This will reset the form and remove saved data from this device.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onClear}
                className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
