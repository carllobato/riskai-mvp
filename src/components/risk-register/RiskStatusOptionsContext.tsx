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
import { normalizeRiskStatusKey } from "@/domain/risk/riskFieldSemantics";
import { dlog } from "@/lib/debug";

export type RiskaiRiskStatusRow = { id: string; name: string };

type RiskStatusOptionsContextValue = {
  statuses: RiskaiRiskStatusRow[];
  loading: boolean;
  error: string | null;
};

const defaultValue: RiskStatusOptionsContextValue = {
  statuses: [],
  loading: true,
  error: null,
};

const RiskStatusOptionsContext = createContext<RiskStatusOptionsContextValue>(defaultValue);

export function RiskStatusOptionsProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<RiskaiRiskStatusRow[]>([]);
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
          .from("riskai_risk_statuses")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true });
        if (cancelled) return;
        if (qError) {
          setError(qError.message);
          setStatuses([]);
          return;
        }
        const rows = [...((data ?? []) as RiskaiRiskStatusRow[])];
        const orderRank = (name: string): number => {
          const k = normalizeRiskStatusKey(name);
          const order = ["draft", "open", "monitoring", "mitigating", "closed", "archived"];
          const i = order.indexOf(k);
          return i === -1 ? 99 : i;
        };
        rows.sort((a, b) => orderRank(a.name) - orderRank(b.name) || a.name.localeCompare(b.name));
        dlog("[risk statuses] fetched", rows);
        setStatuses(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load statuses");
          setStatuses([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<RiskStatusOptionsContextValue>(
    () => ({ statuses, loading, error }),
    [statuses, loading, error]
  );

  return (
    <RiskStatusOptionsContext.Provider value={value}>{children}</RiskStatusOptionsContext.Provider>
  );
}

export function useRiskStatusOptions() {
  return useContext(RiskStatusOptionsContext);
}
