"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LegalDocumentModal, type LegalDocumentId } from "./LegalDocumentModal";

type LegalDocumentContextValue = {
  openLegalDocument: (id: LegalDocumentId) => void;
};

const LegalDocumentContext = createContext<LegalDocumentContextValue | null>(null);

export function useLegalDocument() {
  const ctx = useContext(LegalDocumentContext);
  if (!ctx) {
    throw new Error("useLegalDocument must be used within LegalDocumentProvider");
  }
  return ctx;
}

export function LegalDocumentProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<LegalDocumentId | null>(null);

  const openLegalDocument = useCallback((id: LegalDocumentId) => {
    setActive(id);
  }, []);

  const close = useCallback(() => setActive(null), []);

  const value = useMemo(() => ({ openLegalDocument }), [openLegalDocument]);

  return (
    <LegalDocumentContext.Provider value={value}>
      {children}
      {active ? <LegalDocumentModal legalDocument={active} onClose={close} /> : null}
    </LegalDocumentContext.Provider>
  );
}
