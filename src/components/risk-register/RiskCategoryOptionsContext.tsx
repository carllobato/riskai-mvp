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

export type RiskaiRiskCategoryRow = { id: string; name: string };

type RiskCategoryOptionsContextValue = {
  categories: RiskaiRiskCategoryRow[];
  loading: boolean;
  error: string | null;
  categoryNames: string[];
};

const defaultValue: RiskCategoryOptionsContextValue = {
  categories: [],
  loading: true,
  error: null,
  categoryNames: [],
};

const RiskCategoryOptionsContext = createContext<RiskCategoryOptionsContextValue>(defaultValue);

export function RiskCategoryOptionsProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<RiskaiRiskCategoryRow[]>([]);
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
          .from("riskai_risk_categories")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true });
        if (cancelled) return;
        if (qError) {
          setError(qError.message);
          setCategories([]);
          return;
        }
        const rows = (data ?? []) as RiskaiRiskCategoryRow[];
        dlog("[risk categories] fetched", rows);
        setCategories(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load categories");
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<RiskCategoryOptionsContextValue>(
    () => ({
      categories,
      loading,
      error,
      categoryNames: categories.map((c) => c.name),
    }),
    [categories, loading, error]
  );

  return (
    <RiskCategoryOptionsContext.Provider value={value}>{children}</RiskCategoryOptionsContext.Provider>
  );
}

export function useRiskCategoryOptions() {
  return useContext(RiskCategoryOptionsContext);
}
