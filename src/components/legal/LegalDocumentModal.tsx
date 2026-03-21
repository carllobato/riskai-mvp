"use client";

import { useEffect } from "react";
import { PrivacyPolicyContent } from "./PrivacyPolicyContent";
import { TermsContent } from "./TermsContent";

export type LegalDocumentId = "privacy" | "terms";

const documentMeta: Record<
  LegalDocumentId,
  { title: string; subtitle: string; effectiveDate: string }
> = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "How Visualify handles your data",
    effectiveDate: "March 21, 2026",
  },
  terms: {
    title: "Terms & Conditions",
    subtitle: "Rules for using Visualify and RiskAI",
    effectiveDate: "March 21, 2026",
  },
};

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function LegalDocumentModal({ legalDocument, onClose }: { legalDocument: LegalDocumentId; onClose: () => void }) {
  const meta = documentMeta[legalDocument];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-md transition-opacity dark:bg-black/75"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-doc-title"
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200/60 bg-neutral-50/95 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.2)] dark:border-neutral-800/50 dark:bg-neutral-950 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/50 px-6 pt-6 dark:border-neutral-800/50 sm:px-8 sm:pt-7">
          <div className="min-w-0 flex-1">
            <h1
              id="legal-doc-title"
              className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-[1.75rem]"
            >
              {meta.title}
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{meta.subtitle}</p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Effective {meta.effectiveDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 cursor-pointer rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 dark:focus-visible:outline-neutral-400"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {legalDocument === "privacy" ? <PrivacyPolicyContent inModal /> : <TermsContent inModal />}
        </div>

        {/* Footer — subtle close only */}
        <div className="flex shrink-0 items-center justify-end border-t border-neutral-200/50 px-6 py-3 dark:border-neutral-800/50 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-100 dark:focus-visible:outline-neutral-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
