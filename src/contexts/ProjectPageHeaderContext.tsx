"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type ProjectPageHeaderExtras = {
  titleSuffix: string;
  end: ReactNode | null;
};

type ProjectPageHeaderExtrasContextValue = {
  extras: ProjectPageHeaderExtras | null;
  setExtras: (extras: ProjectPageHeaderExtras | null) => void;
};

const ProjectPageHeaderExtrasContext =
  createContext<ProjectPageHeaderExtrasContextValue | null>(null);

export function ProjectPageHeaderExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtrasState] = useState<ProjectPageHeaderExtras | null>(null);
  const setExtras = useCallback((next: ProjectPageHeaderExtras | null) => {
    setExtrasState(next);
  }, []);

  return (
    <ProjectPageHeaderExtrasContext.Provider value={{ extras, setExtras }}>
      {children}
    </ProjectPageHeaderExtrasContext.Provider>
  );
}

export function useProjectPageHeaderExtras(): ProjectPageHeaderExtrasContextValue {
  const ctx = useContext(ProjectPageHeaderExtrasContext);
  if (!ctx) {
    throw new Error("useProjectPageHeaderExtras must be used within ProjectPageHeaderExtrasProvider");
  }
  return ctx;
}
