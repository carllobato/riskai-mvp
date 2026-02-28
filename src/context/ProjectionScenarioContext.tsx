"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ProjectionProfile } from "@/lib/projectionProfiles";
import type { ScenarioLensMode } from "@/lib/instability/selectScenarioLens";

const STORAGE_KEY = "riskai.projectionProfile";
const LENS_MODE_KEY = "riskai.scenarioLensMode";
const UI_MODE_KEY = "riskai.uiMode";

export type UiMode = "Meeting" | "Diagnostic";

function getInitialProfile(): ProjectionProfile {
  if (typeof window === "undefined") return "neutral";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "conservative" || stored === "neutral" || stored === "aggressive")
      return stored;
  } catch {
    // ignore
  }
  return "neutral";
}

function getInitialLensMode(): ScenarioLensMode {
  if (typeof window === "undefined") return "Manual";
  try {
    const stored = localStorage.getItem(LENS_MODE_KEY);
    if (stored === "Manual" || stored === "Auto") return stored;
  } catch {
    // ignore
  }
  return "Manual";
}

function getInitialUiMode(): UiMode {
  if (typeof window === "undefined") return "Meeting";
  try {
    const stored = localStorage.getItem(UI_MODE_KEY);
    if (stored === "Meeting" || stored === "Diagnostic") return stored;
  } catch {
    // ignore
  }
  return "Meeting";
}

const PROFILE_LABELS: Record<ProjectionProfile, string> = {
  conservative: "Conservative",
  neutral: "Neutral",
  aggressive: "Aggressive",
};

export function getProfileLabel(profile: ProjectionProfile): string {
  return PROFILE_LABELS[profile];
}

type ProjectionScenarioContextValue = {
  profile: ProjectionProfile;
  setProfile: (profile: ProjectionProfile) => void;
  getProfileLabel: (profile: ProjectionProfile) => string;
  /** Day 11 A4: Manual = use profile; Auto = use each risk's recommended scenario for display. */
  lensMode: ScenarioLensMode;
  setLensMode: (mode: ScenarioLensMode) => void;
  /** Meeting = executive, clean; Diagnostic = show lens debug, breakdowns, flags. */
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
  const [profile, setProfileState] = useState<ProjectionProfile>("neutral");
  const [lensMode, setLensModeState] = useState<ScenarioLensMode>("Manual");
  const [uiMode, setUiModeState] = useState<UiMode>("Meeting");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProfileState(getInitialProfile());
    setLensModeState(getInitialLensMode());
    setUiModeState(getInitialUiMode());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, profile);
    } catch {
      // ignore
    }
  }, [profile, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LENS_MODE_KEY, lensMode);
    } catch {
      // ignore
    }
  }, [lensMode, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(UI_MODE_KEY, uiMode);
    } catch {
      // ignore
    }
  }, [uiMode, mounted]);

  const setProfile = useCallback((next: ProjectionProfile) => {
    setProfileState(next);
  }, []);

  const setLensMode = useCallback((next: ScenarioLensMode) => {
    setLensModeState(next);
  }, []);

  const setUiMode = useCallback((next: UiMode) => {
    setUiModeState(next);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      getProfileLabel: getProfileLabel,
      lensMode,
      setLensMode,
      uiMode,
      setUiMode,
    }),
    [profile, setProfile, lensMode, setLensMode, uiMode, setUiMode]
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
