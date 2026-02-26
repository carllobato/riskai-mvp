"use client";

import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { Risk } from "@/domain/risk/risk.schema";
import { saveJson, loadJson } from "@/lib/storage";
import { nowIso } from "@/lib/time";

const STORAGE_KEY = "riskai:riskRegister:v1";

type State = {
  risks: Risk[];
};

type Action =
  | { type: "risks/set"; risks: Risk[] }                       // replace (e.g., extraction result)
  | { type: "risk/update"; id: string; patch: Partial<Risk> }  // inline edit
  | { type: "risk/add"; risk: Risk }
  | { type: "risk/delete"; id: string }
  | { type: "risks/clear" };

const initialState: State = { risks: [] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "risks/set":
      return { ...state, risks: action.risks };

    case "risk/update": {
      const risks = state.risks.map((r) => {
        if (r.id !== action.id) return r;
        const updated: Risk = {
          ...r,
          ...action.patch,
          updatedAt: nowIso(),
        };
        return updated;
      });
      return { ...state, risks };
    }

    case "risk/add":
      return { ...state, risks: [action.risk, ...state.risks] };

    case "risk/delete":
      return { ...state, risks: state.risks.filter((r) => r.id !== action.id) };

    case "risks/clear":
      return { ...state, risks: [] };

    default:
      return state;
  }
}

type Ctx = {
  risks: Risk[];
  addRisk: (risk: Risk) => void;
  setRisks: (risks: Risk[]) => void;
  updateRisk: (id: string, patch: Partial<Risk>) => void;
  deleteRisk: (id: string) => void;
  clearRisks: () => void;
};

const RiskRegisterContext = createContext<Ctx | null>(null);

export function RiskRegisterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate once
  useEffect(() => {
    const saved = loadJson<State>(STORAGE_KEY);
    if (saved?.risks?.length) {
      dispatch({ type: "risks/set", risks: saved.risks });
    }
  }, []);

  // Persist on change
  useEffect(() => {
    saveJson(STORAGE_KEY, state);
  }, [state]);

  const value = useMemo<Ctx>(
    () => ({
      risks: state.risks,
      addRisk: (risk) => dispatch({ type: "risk/add", risk }),
      setRisks: (risks) => dispatch({ type: "risks/set", risks }),
      updateRisk: (id, patch) => dispatch({ type: "risk/update", id, patch }),
      deleteRisk: (id) => dispatch({ type: "risk/delete", id }),
      clearRisks: () => dispatch({ type: "risks/clear" }),
    }),
    [state.risks]
  );

  return <RiskRegisterContext.Provider value={value}>{children}</RiskRegisterContext.Provider>;
}

export function useRiskRegister(): Ctx {
  const ctx = useContext(RiskRegisterContext);
  if (!ctx) throw new Error("useRiskRegister must be used within RiskRegisterProvider");
  return ctx;
}