"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
const UI_MODE_KEY = "riskai.uiMode";

export type UiMode = "MVP" | "Debug";

function getInitialUiMode(): UiMode {
  if (typeof window === "undefined") return "MVP";
  try {
    const stored = localStorage.getItem(UI_MODE_KEY);
    if (stored === "MVP" || stored === "Debug") return stored;
    if (stored === "Meeting") return "MVP";
    if (stored === "Diagnostic") return "Debug";
  } catch {
    // ignore
  }
  return "MVP";
}

type ProjectionScenarioContextValue = {
  /** MVP = executive, clean; Debug = show lens debug, breakdowns, flags. */
  uiMode: UiMode;
  setUiMode: (mode: UiMode) => void;
};

const ProjectionScenarioContext =
  createContext<ProjectionScenarioContextValue | null>(null);

export function ProjectionScenarioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [uiMode, setUiModeState] = useState<UiMode>(() => getInitialUiMode());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(UI_MODE_KEY, uiMode);
    } catch {
      // ignore
    }
  }, [uiMode, mounted]);

  const setUiMode = useCallback((next: UiMode) => {
    setUiModeState(next);
  }, []);

  const value = useMemo(
    () => ({
      uiMode,
      setUiMode,
    }),
    [uiMode, setUiMode]
  );

  return (
    <ProjectionScenarioContext.Provider value={value}>
      {children}
    </ProjectionScenarioContext.Provider>
  );
}

export function useProjectionScenario(): ProjectionScenarioContextValue {
  const ctx = useContext(ProjectionScenarioContext);
  if (!ctx)
    throw new Error(
      "useProjectionScenario must be used within ProjectionScenarioProvider"
    );
  return ctx;
}
