"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { saveFile, loadFiles, markFileImported } from "@/lib/uploadedRiskRegisterStore";
import { parseExcel, sheetToDocumentText } from "@/lib/riskImportExcel";
import type { Risk, RiskDraft } from "@/domain/risk/risk.schema";
import { RiskDraftSchema, RiskSchema } from "@/domain/risk/risk.schema";
import { draftsToRisks } from "@/domain/risk/risk.mapper";
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

const btnPrimary =
  "px-4 py-2 rounded-md bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 text-sm font-medium hover:bg-neutral-700 dark:hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-400 shrink-0";
const btnSecondary =
  "px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 shrink-0";

export function CreateRiskFileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { appendRisks } = useRiskRegister();
  const [fileDragOver, setFileDragOver] = useState(false);
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fileUploadMessage, setFileUploadMessage] = useState<string | null>(null);
  const [lastSavedFileId, setLastSavedFileId] = useState<string | null>(null);
  const [lastSavedFileName, setLastSavedFileName] = useState<string | null>(null);
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/75 dark:bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-risk-file-dialog-title"
      onClick={handleBackdropClick}
    >
      <div
        style={{ width: "90vw", maxWidth: 480, maxHeight: "90vh" }}
        className="shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 shrink-0 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 py-3">
          <h2 id="create-risk-file-dialog-title" className="text-lg font-semibold text-[var(--foreground)]">
            Create Risk with AI File Uploader
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md border border-transparent text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
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
            className={`border-2 border-dashed rounded-md p-6 text-center text-sm transition-colors min-h-[120px] flex flex-col justify-center ${
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
          <button
            type="button"
            onClick={handleGenerateRisk}
            disabled={!lastSavedFileId || generateStatus === "loading"}
            className={`${btnPrimary} w-full`}
          >
            Generate Risk
          </button>
          {generateStatus === "loading" && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Extracting risks…</p>
          )}
          {generateStatus === "success" && generateMessage && (
            <p className="text-sm text-blue-600 dark:text-blue-400" role="status">
              {generateMessage}
            </p>
          )}
          {generateStatus === "error" && generateMessage && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {generateMessage}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 shrink-0 px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
