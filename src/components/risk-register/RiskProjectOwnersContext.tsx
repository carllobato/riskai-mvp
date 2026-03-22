"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { dlog } from "@/lib/debug";

export type RiskaiProjectOwnerRow = { id: string; name: string };

type RiskProjectOwnersContextValue = {
  projectId: string;
  owners: RiskaiProjectOwnerRow[];
  ownerNames: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Inserts if trimmed name is non-empty and not already present for this project. */
  createProjectOwner: (name: string) => Promise<void>;
};

const RiskProjectOwnersContext = createContext<RiskProjectOwnersContextValue | null>(null);

export function RiskProjectOwnersProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [owners, setOwners] = useState<RiskaiProjectOwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOwners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = supabaseBrowserClient();
      const { data, error: qError } = await supabase
        .from("riskai_project_owners")
        .select("id, name")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (qError) {
        setError(qError.message);
        setOwners([]);
        return;
      }
      const rows = (data ?? []) as RiskaiProjectOwnerRow[];
      dlog("[risk owners] fetched", rows);
      setOwners(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load owners");
      setOwners([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadOwners();
  }, [loadOwners]);

  const createProjectOwner = useCallback(
    async (rawName: string) => {
      const name = rawName.trim();
      if (!name) return;
      const supabase = supabaseBrowserClient();
      const { error: insError } = await supabase.from("riskai_project_owners").insert({
        project_id: projectId,
        name,
      });
      if (insError && !/duplicate key|unique constraint/i.test(insError.message)) {
        throw new Error(insError.message);
      }
      dlog("[risk owner] created new owner", name);
      await loadOwners();
    },
    [projectId, loadOwners]
  );

  const value = useMemo<RiskProjectOwnersContextValue>(
    () => ({
      projectId,
      owners,
      ownerNames: owners.map((o) => o.name),
      loading,
      error,
      refetch: loadOwners,
      createProjectOwner,
    }),
    [projectId, owners, loading, error, loadOwners, createProjectOwner]
  );

  return (
    <RiskProjectOwnersContext.Provider value={value}>{children}</RiskProjectOwnersContext.Provider>
  );
}

export function useRiskProjectOwners(): RiskProjectOwnersContextValue {
  const ctx = useContext(RiskProjectOwnersContext);
  if (!ctx) {
    throw new Error("useRiskProjectOwners must be used within RiskProjectOwnersProvider");
  }
  return ctx;
}
