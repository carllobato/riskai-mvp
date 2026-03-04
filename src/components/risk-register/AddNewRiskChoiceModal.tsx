"use client";

import { useCallback, useRef, useState } from "react";
import { saveFile, loadFiles, markFileImported } from "@/lib/uploadedRiskRegisterStore";
import { parseExcel, sheetToDocumentText } from "@/lib/riskImportExcel";
import type { Risk, RiskDraft } from "@/domain/risk/risk.schema";
import { RiskDraftSchema, RiskSchema } from "@/domain/risk/risk.schema";
import { draftsToRisks, intelligentDraftToRisk } from "@/domain/risk/risk.mapper";
import { useRiskRegister } from "@/store/risk-register.store";

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

const containerClass =
  "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 flex flex-col min-h-[280px] min-w-0";
const boxTitleClass =
  "text-base font-medium text-[var(--foreground)] mb-2 border-b border-neutral-200 dark:border-neutral-700 pb-2";
const btnPrimary =
  "px-4 py-2 rounded-md bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 text-sm font-medium hover:bg-neutral-700 dark:hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-400 shrink-0";

/** Context of the uploaded file – used to determine which API to run (not yet passed to API). */
export type FileContext =
  | "risk_register"
  | "variation_change"
  | "early_warning"
  | "delay_extension";

const FILE_CONTEXT_OPTIONS: { value: FileContext; label: string }[] = [
  { value: "risk_register", label: "Risk Register" },
  { value: "variation_change", label: "Variation/Change" },
  { value: "early_warning", label: "Early Warning" },
  { value: "delay_extension", label: "Delay/Extension" },
];

export function AddNewRiskChoiceModal({
  open,
  onClose,
  onRisksAdded,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after risks are successfully extracted/imported; use to e.g. open detail for first risk */
  onRisksAdded?: (riskIds: string[]) => void;
}) {
  const { appendRisks } = useRiskRegister();
  const [documentText, setDocumentText] = useState("");
  const [fileDragOver, setFileDragOver] = useState(false);
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fileUploadMessage, setFileUploadMessage] = useState<string | null>(null);
  const [lastSavedFileId, setLastSavedFileId] = useState<string | null>(null);
  const [lastSavedFileName, setLastSavedFileName] = useState<string | null>(null);
  /** Context of the uploaded file (required when using file path; used later for API selection). */
  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFile = !!lastSavedFileId;
  const hasText = documentText.trim().length > 0;
  const canGenerate =
    (hasFile ? !!fileContext : true) && (hasFile || hasText) && generateStatus !== "loading";

  const handleFileSave = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setFileUploadStatus("error");
      setFileUploadMessage("Only .xlsx files are allowed.");
      return;
    }
    setFileUploadStatus("loading");
    setFileUploadMessage(null);
    setGenerateMessage(null);
    setFileContext(null);
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
      onRisksAdded?.(list.map((r) => r.id));
    } catch (e) {
      setGenerateMessage(e instanceof Error ? e.message : "Network or unexpected error");
      setGenerateStatus("error");
    }
  }, [lastSavedFileId, appendRisks, onRisksAdded]);

  const handleExtractFromText = useCallback(async () => {
    const text = documentText.trim();
    if (!text) {
      setGenerateStatus("error");
      setGenerateMessage("Enter risk description in text, or upload a file.");
      return;
    }
    setGenerateStatus("loading");
    setGenerateMessage(null);
    try {
      const res = await fetch("/api/ai/extract-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Extract failed";
        setGenerateMessage(msg);
        setGenerateStatus("error");
        return;
      }
      const draft = data?.risk;
      if (!draft) {
        setGenerateMessage("Invalid response: missing risk");
        setGenerateStatus("error");
        return;
      }
      const risk = intelligentDraftToRisk(draft);
      appendRisks([risk]);
      setGenerateStatus("success");
      setGenerateMessage("Risk extracted. You can edit and save in the detail view.");
      onRisksAdded?.([risk.id]);
    } catch (e) {
      setGenerateMessage(e instanceof Error ? e.message : "Network or unexpected error");
      setGenerateStatus("error");
    }
  }, [documentText, appendRisks, onRisksAdded]);

  const handleGenerate = useCallback(() => {
    if (hasFile) {
      handleGenerateRisk();
    } else if (hasText) {
      handleExtractFromText();
    } else {
      setGenerateStatus("error");
      setGenerateMessage("Enter risk description in text, or upload a file.");
    }
  }, [hasFile, hasText, handleGenerateRisk, handleExtractFromText]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/75 dark:bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-new-risk-choice-title"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-[70vw] max-h-[90vh] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-2xl overflow-hidden flex flex-col min-h-[400px] min-w-[280px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 py-3">
          <h2 id="add-new-risk-choice-title" className="text-xl font-semibold text-[var(--foreground)]">
            Add new risk
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
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Choose how you want to add a risk:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={containerClass}>
              <h3 className={boxTitleClass}>Generate Risk with Text Entry</h3>
              <textarea
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                placeholder="Describe your risk including any mitigation, cost and time data."
                rows={6}
                className="flex-1 min-h-[120px] w-full box-border px-3 py-2.5 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm font-[inherit] resize-y focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-transparent mt-1"
              />
            </div>
            <div className={containerClass}>
              <h3 className={boxTitleClass}>Generate Risk with a file</h3>
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
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">Saving…</p>
              )}
              {fileUploadStatus === "error" && fileUploadMessage && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">
                  {fileUploadMessage}
                </p>
              )}
              {lastSavedFileId && (
                <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-600">
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Define the context of the file
                  </label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                    Used to run the appropriate process for this file.
                  </p>
                  <select
                    value={fileContext ?? ""}
                    onChange={(e) =>
                      setFileContext((e.target.value as FileContext) || null)
                    }
                    className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                    aria-label="File context"
                  >
                    <option value="">Select context…</option>
                    {FILE_CONTEXT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`${btnPrimary} w-full sm:w-auto min-w-[160px]`}
            >
              Generate
            </button>
            {hasFile && !fileContext && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2" role="status">
                Select the context of the file above (Risk Register, Variation/Change, etc.) to enable Generate.
              </p>
            )}
            {generateStatus === "loading" && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">Extracting risks…</p>
            )}
            {generateStatus === "success" && generateMessage && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2" role="status">
                {generateMessage}
              </p>
            )}
            {generateStatus === "error" && generateMessage && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">
                {generateMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
