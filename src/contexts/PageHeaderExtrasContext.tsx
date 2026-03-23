"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PageHeaderExtras = {
  titleSuffix: string;
  end: ReactNode | null;
};

type PageHeaderExtrasContextValue = {
  extras: PageHeaderExtras | null;
  setExtras: (extras: PageHeaderExtras | null) => void;
};

const PageHeaderExtrasContext = createContext<PageHeaderExtrasContextValue | null>(null);

export function PageHeaderExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtrasState] = useState<PageHeaderExtras | null>(null);
  const setExtras = useCallback((next: PageHeaderExtras | null) => {
    setExtrasState(next);
  }, []);

  const value = useMemo(
    () => ({ extras, setExtras }),
    [extras, setExtras]
  );

  return (
    <PageHeaderExtrasContext.Provider value={value}>
      {children}
    </PageHeaderExtrasContext.Provider>
  );
}

export function usePageHeaderExtras(): PageHeaderExtrasContextValue {
  const ctx = useContext(PageHeaderExtrasContext);
  if (!ctx) {
    throw new Error("usePageHeaderExtras must be used within PageHeaderExtrasProvider");
  }
  return ctx;
}

/** For shared page bodies that may render with or without a layout `PageHeaderExtrasProvider`. */
export function useOptionalPageHeaderExtras(): PageHeaderExtrasContextValue | null {
  return useContext(PageHeaderExtrasContext);
}
