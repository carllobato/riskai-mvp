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

const STORAGE_KEY = "riskai.projectionProfile";

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
};

const ProjectionScenarioContext =
  createContext<ProjectionScenarioContextValue | null>(null);

export function ProjectionScenarioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfileState] = useState<ProjectionProfile>("neutral");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProfileState(getInitialProfile());
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

  const setProfile = useCallback((next: ProjectionProfile) => {
    setProfileState(next);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      getProfileLabel: getProfileLabel,
    }),
    [profile, setProfile]
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
