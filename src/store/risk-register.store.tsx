"use client";

import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { Risk, RiskRating } from "@/domain/risk/risk.schema";
import type { SimulationSnapshot, SimulationDelta } from "@/domain/simulation/simulation.types";
import { buildRating } from "@/domain/risk/risk.logic";
import { calculateDelta } from "@/lib/calculateDelta";
import { enrichSnapshotWithIntelligenceMetrics } from "@/lib/simulationSelectors";
import { simulatePortfolio } from "@/lib/simulatePortfolio";
import { loadState, saveState } from "@/store/persist";
import { nowIso } from "@/lib/time";

const STORAGE_KEY = "riskai:riskRegister:v1";
const PERSIST_SCHEMA_VERSION = 1;

/** Minimal persisted shape: risks + simulation (current + history only; no delta). */
type PersistedState = {
  schemaVersion: number;
  risks: Risk[];
  simulation: { current?: SimulationSnapshot; history: SimulationSnapshot[] };
};

/** Migrate persisted risks from legacy inherent/residual to inherentRating/residualRating. */
function migrateRisks(risks: unknown[]): Risk[] {
  return risks.map((r) => {
    if (!r || typeof r !== "object") return null;
    const raw = r as Record<string, unknown>;
    const inherentRating = (raw.inherentRating as RiskRating | undefined) ?? (raw.inherent as RiskRating | undefined);
    const residualRating = (raw.residualRating as RiskRating | undefined) ?? (raw.residual as RiskRating | undefined) ?? inherentRating;
    if (!inherentRating || !residualRating) return null;
    return { ...raw, inherentRating, residualRating } as Risk;
  }).filter((r): r is Risk => r != null);
}

const SIMULATION_HISTORY_CAP = 20;

type State = {
  risks: Risk[];
  simulation: {
    current?: SimulationSnapshot;
    history: SimulationSnapshot[];
    delta?: SimulationDelta | null;
  };
};

type Action =
  | { type: "risks/set"; risks: Risk[] }                       // replace (e.g., hydrate)
  | { type: "risks/append"; risks: Risk[] }                     // append (e.g., extraction); skip duplicate ids
  | { type: "risk/update"; id: string; patch: Partial<Risk> }  // inline edit
  | { type: "RISK_UPDATE_RATING_PC"; payload: { id: string; target: "inherent" | "residual"; probability?: number; consequence?: number } }
  | { type: "risk/add"; risk: Risk }
  | { type: "risk/delete"; id: string }
  | { type: "risks/clear" }
  | { type: "simulation/run"; snapshot: SimulationSnapshot }
  | { type: "simulation/clearHistory" }
  | { type: "simulation/setDelta"; delta: SimulationDelta | null }
  | { type: "simulation/hydrate"; payload: { current?: SimulationSnapshot; history: SimulationSnapshot[] } };

const initialSimulation = { history: [] as SimulationSnapshot[], delta: null as SimulationDelta | null };
const initialState: State = { risks: [], simulation: initialSimulation };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "risks/set":
      return { ...state, risks: action.risks };

    case "risks/append": {
      const existingIds = new Set(state.risks.map((r) => r.id));
      const newRisks = action.risks.filter((r) => !existingIds.has(r.id));
      return { ...state, risks: [...state.risks, ...newRisks] };
    }

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

    case "RISK_UPDATE_RATING_PC": {
      const { id, target, probability: payloadP, consequence: payloadC } = action.payload;
      const risks = state.risks.map((r) => {
        if (r.id !== id) return r;
        const current = target === "inherent" ? r.inherentRating : r.residualRating;
        const nextP = payloadP ?? current.probability;
        const nextC = payloadC ?? current.consequence;
        const newRating = buildRating(nextP, nextC);
        const updated: Risk = {
          ...r,
          inherentRating: target === "inherent" ? newRating : r.inherentRating,
          residualRating: target === "residual" ? newRating : r.residualRating,
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

    case "simulation/run": {
      const nextHistoryRaw = [action.snapshot, ...state.simulation.history].slice(
        0,
        SIMULATION_HISTORY_CAP
      );
      const enriched = enrichSnapshotWithIntelligenceMetrics(
        action.snapshot,
        nextHistoryRaw
      );
      const nextHistory = [enriched, ...state.simulation.history].slice(
        0,
        SIMULATION_HISTORY_CAP
      );
      return {
        ...state,
        simulation: {
          ...state.simulation,
          current: enriched,
          history: nextHistory,
        },
      };
    }

    case "simulation/clearHistory":
      return {
        ...state,
        simulation: { history: [], delta: null },
      };

    case "simulation/setDelta":
      return {
        ...state,
        simulation: { ...state.simulation, delta: action.delta },
      };

    case "simulation/hydrate": {
      const { current, history } = action.payload;
      const capped = Array.isArray(history) ? history.slice(0, SIMULATION_HISTORY_CAP) : [];
      return {
        ...state,
        simulation: {
          ...state.simulation,
          current: current ?? undefined,
          history: capped,
        },
      };
    }

    default:
      return state;
  }
}

type Ctx = {
  risks: Risk[];
  addRisk: (risk: Risk) => void;
  setRisks: (risks: Risk[]) => void;
  appendRisks: (risks: Risk[]) => void;
  updateRisk: (id: string, patch: Partial<Risk>) => void;
  updateRatingPc: (id: string, target: "inherent" | "residual", payload: { probability?: number; consequence?: number }) => void;
  deleteRisk: (id: string) => void;
  clearRisks: () => void;
  simulation: State["simulation"];
  runSimulation: (iterations?: number) => void;
  clearSimulationHistory: () => void;
  setSimulationDelta: (delta: SimulationDelta | null) => void;
};

const RiskRegisterContext = createContext<Ctx | null>(null);

export function RiskRegisterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate once: restore risks and simulation from localStorage (backward compat: old format had only risks or full state)
  useEffect(() => {
    const saved = loadState<PersistedState | { risks?: unknown[]; simulation?: { current?: SimulationSnapshot; history?: SimulationSnapshot[] } }>(STORAGE_KEY);
    if (!saved || typeof saved !== "object") return;
    const risks = "risks" in saved && Array.isArray(saved.risks) ? saved.risks : [];
    if (risks.length > 0) {
      const migrated = migrateRisks(risks);
      if (migrated.length) dispatch({ type: "risks/set", risks: migrated });
    }
    const sim = "simulation" in saved && saved.simulation && Array.isArray(saved.simulation.history) ? saved.simulation : null;
    if (sim) {
      dispatch({
        type: "simulation/hydrate",
        payload: { current: sim.current, history: sim.history ?? [] },
      });
    }
  }, []);

  // Persist on change (minimal: risks + simulation current/history only)
  useEffect(() => {
    const payload: PersistedState = {
      schemaVersion: PERSIST_SCHEMA_VERSION,
      risks: state.risks,
      simulation: {
        current: state.simulation.current,
        history: state.simulation.history,
      },
    };
    saveState(STORAGE_KEY, payload);
  }, [state.risks, state.simulation.current, state.simulation.history]);

  const value = useMemo<Ctx>(
    () => ({
      risks: state.risks,
      addRisk: (risk) => dispatch({ type: "risk/add", risk }),
      setRisks: (risks) => dispatch({ type: "risks/set", risks }),
      appendRisks: (risks) => dispatch({ type: "risks/append", risks }),
      updateRisk: (id, patch) => dispatch({ type: "risk/update", id, patch }),
      updateRatingPc: (id, target, payload) =>
        dispatch({ type: "RISK_UPDATE_RATING_PC", payload: { id, target, ...payload } }),
      deleteRisk: (id) => dispatch({ type: "risk/delete", id }),
      clearRisks: () => dispatch({ type: "risks/clear" }),
      simulation: state.simulation,
      runSimulation: (iterations) => {
        const snapshot = simulatePortfolio(state.risks, iterations);
        dispatch({ type: "simulation/run", snapshot });
        const previous = state.simulation.current;
        if (previous) {
          dispatch({ type: "simulation/setDelta", delta: calculateDelta(previous, snapshot) });
        }
      },
      clearSimulationHistory: () => dispatch({ type: "simulation/clearHistory" }),
      setSimulationDelta: (delta) => dispatch({ type: "simulation/setDelta", delta }),
    }),
    [state.risks, state.simulation]
  );

  return <RiskRegisterContext.Provider value={value}>{children}</RiskRegisterContext.Provider>;
}

export function useRiskRegister(): Ctx {
  const ctx = useContext(RiskRegisterContext);
  if (!ctx) throw new Error("useRiskRegister must be used within RiskRegisterProvider");
  return ctx;
}