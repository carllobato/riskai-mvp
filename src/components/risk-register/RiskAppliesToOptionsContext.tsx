"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { dlog } from "@/lib/debug";

export type RiskaiRiskAppliesToRow = { id: string; name: string };

type RiskAppliesToOptionsContextValue = {
  appliesToOptions: RiskaiRiskAppliesToRow[];
  loading: boolean;
  error: string | null;
};

const defaultValue: RiskAppliesToOptionsContextValue = {
  appliesToOptions: [],
  loading: true,
  error: null,
};

const RiskAppliesToOptionsContext = createContext<RiskAppliesToOptionsContextValue>(defaultValue);

export function RiskAppliesToOptionsProvider({ children }: { children: ReactNode }) {
  const [appliesToOptions, setAppliesToOptions] = useState<RiskaiRiskAppliesToRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = supabaseBrowserClient();
        const { data, error: qError } = await supabase
          .from("riskai_risk_applies_to")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true });
        if (cancelled) return;
        if (qError) {
          setError(qError.message);
          setAppliesToOptions([]);
          return;
        }
        const rows = (data ?? []) as RiskaiRiskAppliesToRow[];
        dlog("[risk applies_to] fetched", rows);
        setAppliesToOptions(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load applies-to options");
          setAppliesToOptions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<RiskAppliesToOptionsContextValue>(
    () => ({ appliesToOptions, loading, error }),
    [appliesToOptions, loading, error]
  );

  return (
    <RiskAppliesToOptionsContext.Provider value={value}>{children}</RiskAppliesToOptionsContext.Provider>
  );
}

export function useRiskAppliesToOptions() {
  return useContext(RiskAppliesToOptionsContext);
}
