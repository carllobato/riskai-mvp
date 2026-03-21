"use client";

import type { LegalDocumentId } from "./LegalDocumentModal";
import { useLegalDocument } from "./LegalDocumentProvider";

type Props = {
  document: LegalDocumentId;
  className?: string;
  children: React.ReactNode;
};

export function LegalDocumentLink({ document: doc, className, children }: Props) {
  const { openLegalDocument } = useLegalDocument();
  const href = doc === "privacy" ? "/privacy" : "/terms";

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        openLegalDocument(doc);
      }}
    >
      {children}
    </a>
  );
}
