"use client";

import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { Risk, RiskRating } from "@/domain/risk/risk.schema";
import type {
  SimulationSnapshot,
  SimulationDelta,
  MonteCarloNeutralSnapshot,
} from "@/domain/simulation/simulation.types";
import { buildRating, appendScoreSnapshot } from "@/domain/risk/risk.logic";
import { computeCompositeScore } from "@/domain/decision/decision.score";
import { calculateDelta } from "@/lib/calculateDelta";
import { enrichSnapshotWithIntelligenceMetrics } from "@/lib/simulationSelectors";
import { simulatePortfolio } from "@/lib/simulatePortfolio";
import {
  runMonteCarloSimulation,
  buildSimulationReport,
  buildSimulationSnapshotFromResult,
} from "@/domain/simulation/monteCarlo";
import { makeId } from "@/lib/id";
import type { ProjectionProfile } from "@/lib/projectionProfiles";
import { applyScenarioToRiskInputs } from "@/engine/scenario/applyScenarioToRiskInputs";
import { loadState, saveState } from "@/store/persist";
import { nowIso } from "@/lib/time";
import { getLatestSnapshot, getRiskHistory, addRiskSnapshot } from "@/lib/riskSnapshotHistory";
import { runForwardProjection, getPerRiskScenarioTTC } from "@/lib/riskForecast";
import { selectDecisionByRiskId } from "@/store/selectors";
import { calcScenarioDeltaSummary, calcInstabilityIndex, calcFragility } from "@/lib/instability/calcInstabilityIndex";
import { computeEarlyWarning } from "@/lib/instability/earlyWarning";
import { validateScenarioOrdering } from "@/lib/instability/validateScenarioOrdering";
import { computeForecastConfidence } from "@/lib/forecastConfidence";
import type { RiskMitigationForecast } from "@/domain/risk/risk-forecast.types";
import {
  computePortfolioForwardPressure,
  type PortfolioForwardPressure,
} from "@/lib/portfolioForwardPressure";
import { DEBUG_FORWARD_PROJECTION } from "@/config/debug";
import { runForwardProjectionGuards } from "@/lib/forwardProjectionGuards";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { dlog, dwarn } from "@/lib/debug";

const STORAGE_KEY = "riskai:riskRegister:v1";
const PERSIST_SCHEMA_VERSION = 1;

/** Scenario snapshots keyed by Day 10 profile (one engine, scenario changes parameters). */
export type ScenarioSnapshotsMap = Record<ProjectionProfile, SimulationSnapshot>;

/** Minimal persisted shape: risks + simulation (current + history + scenarioSnapshots + neutral). */
type PersistedState = {
  schemaVersion: number;
  risks: Risk[];
  simulation: {
    current?: SimulationSnapshot;
    history: SimulationSnapshot[];
    scenarioSnapshots?: ScenarioSnapshotsMap;
    neutral?: MonteCarloNeutralSnapshot;
    seed?: number;
  };
};

/** Keys that count as mitigation-related; when one of these is updated and value changed, set lastMitigationUpdate. */
const MITIGATION_FIELDS = new Set<keyof Risk>([
  "mitigation",
  "contingency",
  "mitigationProfile",
]);

/** Ensure risk has scoreHistory (empty array if missing). */
function ensureScoreHistory(risk: Risk): Risk {
  return {
    ...risk,
    scoreHistory: Array.isArray(risk.scoreHistory) ? risk.scoreHistory : [],
  };
}

/** Migrate persisted risks from legacy inherent/residual to inherentRating/residualRating. Optional fields (lastMitigationUpdate, scoreHistory, etc.) preserved from raw; undefined is safe. */
function migrateRisks(risks: unknown[]): Risk[] {
  return risks.map((r) => {
    if (!r || typeof r !== "object") return null;
    const raw = r as Record<string, unknown>;
    const inherentRating = (raw.inherentRating as RiskRating | undefined) ?? (raw.inherent as RiskRating | undefined);
    const residualRating = (raw.residualRating as RiskRating | undefined) ?? (raw.residual as RiskRating | undefined) ?? inherentRating;
    if (!inherentRating || !residualRating) return null;
    const risk = { ...raw, inherentRating, residualRating } as Risk;
    return ensureScoreHistory(risk);
  }).filter((r): r is Risk => r != null);
}

/** Max riskNumber in list, or 0 if none. */
function maxRiskNumber(risks: Risk[]): number {
  return risks.reduce((max, r) => (r.riskNumber != null && r.riskNumber > max ? r.riskNumber : max), 0);
}

/** Assign riskNumber to risks that lack it (backfill). Order preserved; unnumbered get next sequential. */
function backfillRiskNumbers(risks: Risk[]): Risk[] {
  let next = maxRiskNumber(risks) + 1;
  return risks.map((r) => {
    if (r.riskNumber != null) return r;
    return { ...r, riskNumber: next++ };
  });
}

const SIMULATION_HISTORY_CAP = 20;

type State = {
  risks: Risk[];
  simulation: {
    current?: SimulationSnapshot;
    history: SimulationSnapshot[];
    delta?: SimulationDelta | null;
    /** Per-scenario snapshots (same engine, profile changes spread); used for Outputs tiles. */
    scenarioSnapshots?: ScenarioSnapshotsMap;
    /** Neutral snapshot from Monte Carlo (100 iterations): cost/time samples + summary + report. */
    neutral?: MonteCarloNeutralSnapshot;
    /** Optional seed for deterministic Monte Carlo runs. */
    seed?: number;
  };
  /** Per-risk Day 8 forecast (score-based); updated when intelligence/simulation updates. */
  riskForecastsById: Record<string, RiskMitigationForecast>;
};

type Action =
  | { type: "risks/set"; risks: Risk[] }                       // replace (e.g., hydrate)
  | { type: "risks/append"; risks: Risk[] }                     // append (e.g., extraction); skip duplicate ids
  | { type: "risk/update"; id: string; patch: Partial<Risk> }  // inline edit
  | { type: "RISK_UPDATE_RATING_PC"; payload: { id: string; target: "inherent" | "residual"; probability?: number; consequence?: number } }
  | { type: "risk/add"; risk: Risk }
  | { type: "risk/delete"; id: string }
  | { type: "risks/clear" }
  | {
      type: "simulation/run";
      payload: {
        snapshot: SimulationSnapshot;
        scenarioSnapshots?: ScenarioSnapshotsMap;
        neutral?: MonteCarloNeutralSnapshot;
      };
    }
  | { type: "simulation/clearHistory" }
  | { type: "simulation/setDelta"; delta: SimulationDelta | null }
  | {
      type: "simulation/hydrate";
      payload: {
        current?: SimulationSnapshot;
        history: SimulationSnapshot[];
        scenarioSnapshots?: ScenarioSnapshotsMap;
        neutral?: MonteCarloNeutralSnapshot;
        seed?: number;
      };
    }
  | { type: "riskForecasts/set"; payload: Record<string, RiskMitigationForecast> };

const initialSimulation = { history: [] as SimulationSnapshot[], delta: null as SimulationDelta | null };
const initialState: State = { risks: [], simulation: initialSimulation, riskForecastsById: {} };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "risks/set": {
      const withHistory = action.risks.map(ensureScoreHistory);
      const withNumbers = backfillRiskNumbers(withHistory);
      return { ...state, risks: withNumbers };
    }

    case "risks/append": {
      const existingIds = new Set(state.risks.map((r) => r.id));
      let nextNum = maxRiskNumber(state.risks) + 1;
      const newRisks = action.risks
        .filter((r) => !existingIds.has(r.id))
        .map((r) => {
          const risk = ensureScoreHistory({ ...r, riskNumber: r.riskNumber ?? nextNum++ });
          return risk;
        });
      return { ...state, risks: [...state.risks, ...newRisks] };
    }

    case "risk/update": {
      const patchKeys = Object.keys(action.patch) as (keyof Risk)[];
      const risks = state.risks.map((r) => {
        if (r.id !== action.id) return r;
        const hasMitigationValueChange = patchKeys.some((k) => {
          if (!MITIGATION_FIELDS.has(k)) return false;
          return (r as Record<string, unknown>)[k] !== (action.patch as Record<string, unknown>)[k];
        });
        const updated: Risk = ensureScoreHistory({
          ...r,
          ...action.patch,
          ...(hasMitigationValueChange ? { lastMitigationUpdate: Date.now() } : {}),
          updatedAt: nowIso(),
        });
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

    case "risk/add": {
      const nextNum = maxRiskNumber(state.risks) + 1;
      const risk = ensureScoreHistory({
        ...action.risk,
        riskNumber: action.risk.riskNumber ?? nextNum,
      });
      return { ...state, risks: [risk, ...state.risks] };
    }

    case "risk/delete":
      return { ...state, risks: state.risks.filter((r) => r.id !== action.id) };

    case "risks/clear":
      return { ...state, risks: [] };

    case "simulation/run": {
      const snapshot = action.payload.snapshot;
      const scenarioSnapshots = action.payload.scenarioSnapshots;
      const neutral = action.payload.neutral;
      const nextHistoryRaw = [snapshot, ...state.simulation.history].slice(
        0,
        SIMULATION_HISTORY_CAP
      );
      const enriched = enrichSnapshotWithIntelligenceMetrics(
        snapshot,
        nextHistoryRaw
      );
      const nextHistory = [enriched, ...state.simulation.history].slice(
        0,
        SIMULATION_HISTORY_CAP
      );

      // Day 6: append compositeScore snapshot per risk (before persisting)
      const scoreByRiskId = new Map<string, number>();
      for (const r of enriched.risks ?? []) {
        const { score } = computeCompositeScore({
          triggerRate: r.triggerRate,
          velocity: r.velocity,
          volatility: r.volatility,
          stabilityScore: r.stability,
        });
        scoreByRiskId.set(r.id, score);
      }
      const risksWithSnapshot = state.risks.map((risk) => {
        const compositeScore = scoreByRiskId.get(risk.id);
        if (compositeScore === undefined) return risk;
        return appendScoreSnapshot(risk, compositeScore, 10);
      });

      return {
        ...state,
        risks: risksWithSnapshot,
        simulation: {
          ...state.simulation,
          current: enriched,
          history: nextHistory,
          ...(scenarioSnapshots != null && { scenarioSnapshots }),
          ...(neutral != null && { neutral }),
        },
      };
    }

    case "simulation/clearHistory":
      return {
        ...state,
        simulation: {
          ...state.simulation,
          history: [],
          delta: null,
          scenarioSnapshots: undefined,
          neutral: undefined,
        },
      };

    case "simulation/setDelta":
      return {
        ...state,
        simulation: { ...state.simulation, delta: action.delta },
      };

    case "simulation/hydrate": {
      const { current, history, scenarioSnapshots, neutral, seed } = action.payload;
      const capped = Array.isArray(history) ? history.slice(0, SIMULATION_HISTORY_CAP) : [];
      return {
        ...state,
        simulation: {
          ...state.simulation,
          current: current ?? undefined,
          history: capped,
          ...(scenarioSnapshots != null && { scenarioSnapshots }),
          ...(neutral != null && { neutral }),
          ...(seed != null && { seed }),
        },
      };
    }

    case "riskForecasts/set":
      return { ...state, riskForecastsById: action.payload };

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
  /** True when any risk has status "draft"; simulation must not run until user saves drafts to open. */
  hasDraftRisks: boolean;
  /** Portfolio forward pressure from mitigation stress forecasts (derived from risks + snapshot history). */
  forwardPressure: PortfolioForwardPressure;
  /** Per-risk mitigation stress forecast keyed by riskId (for row-level projection signals). */
  riskForecastsById: Record<string, RiskMitigationForecast>;
};

const RiskRegisterContext = createContext<Ctx | null>(null);

export function RiskRegisterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lastPushedSnapshotKeyRef = React.useRef<string | null>(null);

  // Dev-only: run forward projection guard checks when DEBUG_FORWARD_PROJECTION is true
  useEffect(() => {
    if (DEBUG_FORWARD_PROJECTION) runForwardProjectionGuards();
  }, []);

  // Hydrate once: restore risks and simulation from localStorage (backward compat: old format had only risks or full state)
  useEffect(() => {
    const saved = loadState<PersistedState | { risks?: unknown[]; simulation?: { current?: SimulationSnapshot; history?: SimulationSnapshot[] } }>(STORAGE_KEY);
    if (!saved || typeof saved !== "object") return;
    const risks = "risks" in saved && Array.isArray(saved.risks) ? saved.risks : [];
    if (risks.length > 0) {
      const migrated = migrateRisks(risks);
      if (migrated.length) dispatch({ type: "risks/set", risks: migrated });
    }
    const sim = "simulation" in saved && saved.simulation && Array.isArray((saved.simulation as PersistedState["simulation"]).history) ? saved.simulation as PersistedState["simulation"] : null;
    if (sim) {
      dispatch({
        type: "simulation/hydrate",
        payload: {
          current: sim.current,
          history: sim.history ?? [],
          scenarioSnapshots: sim.scenarioSnapshots,
          neutral: sim.neutral,
          seed: sim.seed,
        },
      });
    }
  }, []);

  // Persist on change (risks + simulation current/history/scenarioSnapshots/neutral/seed)
  useEffect(() => {
    const payload: PersistedState = {
      schemaVersion: PERSIST_SCHEMA_VERSION,
      risks: state.risks,
      simulation: {
        current: state.simulation.current,
        history: state.simulation.history,
        scenarioSnapshots: state.simulation.scenarioSnapshots,
        neutral: state.simulation.neutral,
        seed: state.simulation.seed,
      },
    };
    saveState(STORAGE_KEY, payload);
  }, [
    state.risks,
    state.simulation.current,
    state.simulation.history,
    state.simulation.scenarioSnapshots,
    state.simulation.neutral,
    state.simulation.seed,
  ]);

  // Sync simulation context to server (same as Outputs: neutral = scenarioSnapshots?.neutral ?? current) for mitigation-optimisation API (debounced 300ms)
  useEffect(() => {
    const neutralSnapshot = state.simulation.scenarioSnapshots?.neutral ?? state.simulation.current;
    const riskCount = state.risks.length;
    const hasSnapshot = !!neutralSnapshot;
    const neutralP80 = neutralSnapshot?.p80Cost ?? null;
    const t = setTimeout(() => {
      dlog("[store] sync -> /api/simulation-context", { riskCount, hasSnapshot, neutralP80 });
      fetch("/api/simulation-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ risks: state.risks, neutralSnapshot: neutralSnapshot ?? null }),
      })
        .then((res) => {
          if (!res.ok) dwarn("[store] sync failed", { status: res.status });
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [state.risks, state.simulation.current, state.simulation.scenarioSnapshots]);

  const { profile: projectionProfile } = useProjectionScenario();

  // Canonical forecast update: when simulation/risks or profile change, push decision scores into snapshot history once per run (Day 8 input), then build and store forecast map.
  useEffect(() => {
    const { risks, simulation } = state;
    const snapshotKey = simulation.current ? `${simulation.current.timestampIso ?? simulation.current.id ?? ""}-${simulation.history?.length ?? 0}` : null;
    if (!snapshotKey) lastPushedSnapshotKeyRef.current = null;
    if (simulation.current && risks.length > 0 && snapshotKey !== null && snapshotKey !== lastPushedSnapshotKeyRef.current) {
      lastPushedSnapshotKeyRef.current = snapshotKey;
      const decisionById = selectDecisionByRiskId({ simulation });
      const cycleIndex = Math.max(0, (simulation.history?.length ?? 1) - 1);
      const timestamp = new Date().toISOString();
      for (const risk of risks) {
        const compositeScore = decisionById[risk.id]?.compositeScore ?? 0;
        addRiskSnapshot(risk.id, {
          riskId: risk.id,
          cycleIndex,
          timestamp,
          compositeScore,
        });
      }
    }
    const { riskForecastsById: byId } = runForwardProjection(
      risks,
      getLatestSnapshot,
      getRiskHistory,
      { profile: projectionProfile }
    );
    // Day 11: enrich each forecast with scenario delta summary and EII (additive; no change to scenario/projection logic)
    const enrichedById: Record<string, RiskMitigationForecast> = {};
    const simRisks = state.simulation.current?.risks ?? [];
    const scenarioTTCsForValidation: { conservativeTTC: number | null; neutralTTC: number | null; aggressiveTTC: number | null }[] = [];
    for (const risk of risks) {
      const forecast = byId[risk.id];
      if (!forecast) continue;
      const scenarioTTC = getPerRiskScenarioTTC(
        risk.id,
        getLatestSnapshot,
        getRiskHistory,
        risk.mitigationStrength
      );
      if (process.env.NODE_ENV === "development") {
        scenarioTTCsForValidation.push({
          conservativeTTC: scenarioTTC.conservativeTTC,
          neutralTTC: scenarioTTC.neutralTTC,
          aggressiveTTC: scenarioTTC.aggressiveTTC,
        });
      }
      const scenarioDeltaSummary = calcScenarioDeltaSummary({
        conservativeTTC: scenarioTTC.conservativeTTC,
        neutralTTC: scenarioTTC.neutralTTC,
        aggressiveTTC: scenarioTTC.aggressiveTTC,
      });
      const simRisk = simRisks.find((r) => r.id === risk.id);
      const velocity = simRisk?.velocity ?? 0;
      const volatility = simRisk?.volatility ?? 0;
      const history = getRiskHistory(risk.id);
      const confidenceResult = computeForecastConfidence(history, { includeBreakdown: true });
      const momentumStability = (confidenceResult.breakdown?.stabilityScore ?? 0) / 100;
      const confidence = confidenceResult.score / 100;
      const instability = calcInstabilityIndex({
        velocity,
        volatility,
        momentumStability,
        scenarioSensitivity: scenarioDeltaSummary.normalizedSpread,
        confidence,
        historyDepth: history.length,
      });
      const { earlyWarning, earlyWarningReason } = computeEarlyWarning({
        eiiIndex: instability.index,
        timeToCritical: forecast.baselineForecast.timeToCritical,
        confidence,
      });
      const previousEii = state.riskForecastsById[risk.id]?.instability?.index;
      const eiiDelta = previousEii !== undefined ? instability.index - previousEii : 0;
      const momentum =
        eiiDelta > 5 ? "Rising" : eiiDelta < -5 ? "Falling" : "Stable";
      const fragility = calcFragility({
        currentEii: instability.index,
        previousEii,
        confidencePenalty: instability.breakdown.confidencePenalty,
      });
      enrichedById[risk.id] = {
        ...forecast,
        forecastConfidence: confidenceResult.score,
        scenarioDeltaSummary,
        scenarioTTC: {
          conservative: scenarioTTC.conservativeTTC,
          neutral: scenarioTTC.neutralTTC,
          aggressive: scenarioTTC.aggressiveTTC,
        },
        instability: { ...instability, momentum },
        fragility,
        earlyWarning,
        earlyWarningReason,
      };
    }
    // Ensure every forecast from runForwardProjection is present (fallback to un-enriched)
    for (const id of Object.keys(byId)) {
      if (!(id in enrichedById)) enrichedById[id] = byId[id]!;
    }
    if (process.env.NODE_ENV === "development" && scenarioTTCsForValidation.length > 0) {
      validateScenarioOrdering(scenarioTTCsForValidation);
    }
    dispatch({ type: "riskForecasts/set", payload: enrichedById });
  }, [state.risks, state.simulation.current, state.simulation.history, projectionProfile]);

  const riskForecastsById = state.riskForecastsById;
  const forwardPressure = useMemo(() => {
    const list = Object.values(riskForecastsById);
    const profile = list[0]?.projectionProfileUsed;
    return computePortfolioForwardPressure(list, profile);
  }, [riskForecastsById]);

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
        const hasDraft = state.risks.some((r) => r.status === "draft");
        if (hasDraft) return; // Do not run simulation while any risk is in draft
        const iterCount = iterations ?? 10000;
        const seed =
          state.simulation.seed != null
            ? state.simulation.seed
            : Math.random() * 0xffffffff;

        const neutralRisks = state.risks.map((r) =>
          applyScenarioToRiskInputs(r, "neutral")
        );
        const mcResult = runMonteCarloSimulation({
          risks: neutralRisks,
          iterations: iterCount,
          seed,
        });
        const snapshotFields = buildSimulationSnapshotFromResult(
          mcResult,
          neutralRisks,
          iterCount
        );
        const neutralSnapshot: SimulationSnapshot = {
          ...snapshotFields,
          id: makeId("sim"),
          timestampIso: new Date().toISOString(),
        };
        const summaryReport = buildSimulationReport(mcResult, iterCount);
        const neutral: MonteCarloNeutralSnapshot = {
          costSamples: mcResult.costSamples,
          timeSamples: mcResult.timeSamples,
          summary: mcResult.summary,
          summaryReport,
          lastRunAt: Date.now(),
          iterationCount: iterCount,
        };

        const conservativeRisks = state.risks.map((r) =>
          applyScenarioToRiskInputs(r, "conservative")
        );
        const aggressiveRisks = state.risks.map((r) =>
          applyScenarioToRiskInputs(r, "aggressive")
        );
        const scenarioSnapshots: ScenarioSnapshotsMap = {
          neutral: neutralSnapshot,
          conservative: simulatePortfolio(
            conservativeRisks,
            iterCount,
            { profile: "conservative" }
          ),
          aggressive: simulatePortfolio(
            aggressiveRisks,
            iterCount,
            { profile: "aggressive" }
          ),
        };
        dispatch({
          type: "simulation/run",
          payload: { snapshot: neutralSnapshot, scenarioSnapshots, neutral },
        });
        const previous = state.simulation.current;
        if (previous) {
          dispatch({
            type: "simulation/setDelta",
            delta: calculateDelta(previous, neutralSnapshot),
          });
        }
      },
      clearSimulationHistory: () => dispatch({ type: "simulation/clearHistory" }),
      setSimulationDelta: (delta) => dispatch({ type: "simulation/setDelta", delta }),
      hasDraftRisks: state.risks.some((r) => r.status === "draft"),
      forwardPressure,
      riskForecastsById,
    }),
    [state.risks, state.simulation, forwardPressure, riskForecastsById]
  );

  return <RiskRegisterContext.Provider value={value}>{children}</RiskRegisterContext.Provider>;
}

export function useRiskRegister(): Ctx {
  const ctx = useContext(RiskRegisterContext);
  if (!ctx) throw new Error("useRiskRegister must be used within RiskRegisterProvider");
  return ctx;
}