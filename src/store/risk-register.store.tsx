"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { Risk } from "@/domain/risk/risk.schema";
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
  getEffectiveRiskInputs,
  SIMULATION_ENGINE_VERSION,
} from "@/domain/simulation/monteCarlo";
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
import { binSamplesIntoHistogram, binSamplesIntoTimeHistogram } from "@/lib/simulationDisplayUtils";
import {
  createSnapshot,
  type SimulationSnapshotPayload,
  type SimulationSnapshotRow,
} from "@/lib/db/snapshots";
import { isRiskValid } from "@/domain/risk/runnable-risk.validator";
import {
  isRiskStatusArchived,
  isRiskStatusClosed,
  isRiskStatusDraft,
  RISK_STATUS_ARCHIVED_LOOKUP,
  RISK_STATUS_OPEN_LOOKUP,
} from "@/domain/risk/riskFieldSemantics";

/** Return type for runSimulation: ran true when simulation executed; blockReason and invalidCount when blocked. */
export type RunSimulationResult =
  | { ran: true; snapshotPersistWarning?: string }
  | { ran: false; blockReason: "draft" }
  | { ran: false; blockReason: "invalid"; invalidCount: number };

const STORAGE_KEY = "riskai:riskRegister:v1";
const ACTIVE_PROJECT_KEY = "activeProjectId";
const PERSIST_SCHEMA_VERSION = 1;

const SNAPSHOT_DISTRIBUTION_BINS = 40;

function finiteNum(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** DB rows migrated from legacy may omit P80; previously the app used (P50 + P90) / 2. */
function p80OrP50P90Midpoint(
  p50: number,
  p80Column: number | null | undefined,
  p90: number
): number {
  if (p80Column != null && Number.isFinite(Number(p80Column))) {
    return finiteNum(p80Column);
  }
  return (p50 + p90) / 2;
}

function scenarioSnapshotScalarsForPayload(s: SimulationSnapshot): Record<string, number | undefined> {
  return {
    iterations: s.iterations,
    p20Cost: s.p20Cost,
    p50Cost: s.p50Cost,
    p80Cost: s.p80Cost,
    p90Cost: s.p90Cost,
    totalExpectedCost: s.totalExpectedCost,
    totalExpectedDays: s.totalExpectedDays,
    runDurationMs: s.runDurationMs,
    simStdDev: s.simStdDev,
    triggerRate: s.triggerRate,
  };
}

/** Build store simulation state from a DB snapshot row (so "last run" data can be restored). */
export function buildSimulationFromDbRow(row: SimulationSnapshotRow): {
  current: SimulationSnapshot;
  neutral: MonteCarloNeutralSnapshot;
} | null {
  if (!row || typeof row !== "object") return null;
  const iter = Number(row.iterations) || 0;
  const createdAt = row.created_at ?? new Date().toISOString();
  const ts = new Date(createdAt).getTime();

  const pl = row.payload;
  const sum = pl?.summary;

  const hasReportingScalars =
    row.cost_p20 != null && Number.isFinite(Number(row.cost_p20));

  let p20c: number;
  let p50c: number;
  let p80c: number;
  let p90c: number;
  let meanC: number;
  let minC: number;
  let maxC: number;
  let p20t: number;
  let p50t: number;
  let p80t: number;
  let p90t: number;
  let meanT: number;
  let minT: number;
  let maxT: number;

  if (hasReportingScalars) {
    p20c = finiteNum(row.cost_p20);
    p50c = finiteNum(row.cost_p50);
    p90c = finiteNum(row.cost_p90);
    p80c = p80OrP50P90Midpoint(p50c, row.cost_p80, p90c);
    meanC = finiteNum(row.cost_mean);
    p20t = finiteNum(row.time_p20);
    p50t = finiteNum(row.time_p50);
    p90t = finiteNum(row.time_p90);
    p80t = p80OrP50P90Midpoint(p50t, row.time_p80, p90t);
    meanT = finiteNum(row.time_mean);
    const sumRec = sum && typeof sum === "object" ? (sum as Record<string, unknown>) : null;
    minC =
      row.cost_min != null && Number.isFinite(Number(row.cost_min))
        ? finiteNum(row.cost_min)
        : sumRec != null && sumRec.minCost != null
          ? finiteNum(sumRec.minCost, p20c)
          : p20c;
    maxC =
      row.cost_max != null && Number.isFinite(Number(row.cost_max))
        ? finiteNum(row.cost_max)
        : sumRec != null && sumRec.maxCost != null
          ? finiteNum(sumRec.maxCost, p90c)
          : p90c;
    minT =
      row.time_min != null && Number.isFinite(Number(row.time_min))
        ? finiteNum(row.time_min)
        : sumRec != null && sumRec.minTime != null
          ? finiteNum(sumRec.minTime, p20t)
          : p20t;
    maxT =
      row.time_max != null && Number.isFinite(Number(row.time_max))
        ? finiteNum(row.time_max)
        : sumRec != null && sumRec.maxTime != null
          ? finiteNum(sumRec.maxTime, p90t)
          : p90t;
  } else if (sum && typeof sum === "object") {
    p20c = finiteNum((sum as Record<string, unknown>).p20Cost);
    p50c = finiteNum((sum as Record<string, unknown>).p50Cost);
    p80c = finiteNum((sum as Record<string, unknown>).p80Cost);
    p90c = finiteNum((sum as Record<string, unknown>).p90Cost);
    meanC = finiteNum((sum as Record<string, unknown>).meanCost);
    minC = finiteNum((sum as Record<string, unknown>).minCost);
    maxC = finiteNum((sum as Record<string, unknown>).maxCost);
    p20t = finiteNum((sum as Record<string, unknown>).p20Time);
    p50t = finiteNum((sum as Record<string, unknown>).p50Time);
    p80t = finiteNum((sum as Record<string, unknown>).p80Time);
    p90t = finiteNum((sum as Record<string, unknown>).p90Time);
    meanT = finiteNum((sum as Record<string, unknown>).meanTime);
    minT = finiteNum((sum as Record<string, unknown>).minTime);
    maxT = finiteNum((sum as Record<string, unknown>).maxTime);
  } else {
    p20c = p50c = p80c = p90c = meanC = minC = maxC = 0;
    p20t = p50t = p80t = p90t = meanT = minT = maxT = 0;
  }

  const hydratedRisks = Array.isArray(pl?.risks)
    ? (pl!.risks as SimulationSnapshot["risks"])
    : [];

  const current: SimulationSnapshot = {
    id: (row as { id?: string }).id ?? `db-${createdAt}`,
    timestampIso: createdAt,
    iterations: iter,
    p20Cost: p20c,
    p50Cost: p50c,
    p80Cost: p80c,
    p90Cost: p90c,
    totalExpectedCost: meanC,
    totalExpectedDays: meanT,
    risks: hydratedRisks,
    runDurationMs: row.run_duration_ms != null ? finiteNum(row.run_duration_ms) : undefined,
  };
  const neutral: MonteCarloNeutralSnapshot = {
    costSamples: [],
    timeSamples: [],
    summary: {
      meanCost: meanC,
      p20Cost: p20c,
      p50Cost: p50c,
      p80Cost: p80c,
      p90Cost: p90c,
      minCost: minC,
      maxCost: maxC,
      meanTime: meanT,
      p20Time: p20t,
      p50Time: p50t,
      p80Time: p80t,
      p90Time: p90t,
      minTime: minT,
      maxTime: maxT,
    },
    summaryReport: pl?.summaryReport
      ? {
          iterationCount: iter,
          averageCost: finiteNum(pl.summaryReport.averageCost, meanC),
          averageTime: finiteNum(pl.summaryReport.averageTime, meanT),
          costVolatility: pl.summaryReport.costVolatility,
          p50Cost: finiteNum(pl.summaryReport.p50Cost, p50c),
          p80Cost: finiteNum(pl.summaryReport.p80Cost, p80c),
          p90Cost: finiteNum(pl.summaryReport.p90Cost, p90c),
          minCost: finiteNum(pl.summaryReport.minCost, minC),
          maxCost: finiteNum(pl.summaryReport.maxCost, maxC),
        }
      : {
          iterationCount: iter,
          averageCost: meanC,
          averageTime: meanT,
          p50Cost: p50c,
          p80Cost: p80c,
          p90Cost: p90c,
          minCost: minC,
          maxCost: maxC,
        },
    lastRunAt: ts,
    iterationCount: iter,
  };
  return { current, neutral };
}

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
    /** Per-scenario snapshots (same engine, profile changes spread); used for Run Data tiles. */
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
  | { type: "simulation/setCanonicalId"; payload: { id: string } }
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
          const withStableKey = r.id
            ? r
            : { ...r, tempId: (r as Risk & { tempId?: string }).tempId ?? crypto.randomUUID() };
          return ensureScoreHistory({
            ...withStableKey,
            riskNumber: withStableKey.riskNumber ?? nextNum++,
          });
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
      const withStableKey = action.risk.id
        ? action.risk
        : {
            ...action.risk,
            tempId: (action.risk as Risk & { tempId?: string }).tempId ?? crypto.randomUUID(),
          };
      const risk = ensureScoreHistory({
        ...withStableKey,
        riskNumber: withStableKey.riskNumber ?? nextNum,
      });
      return { ...state, risks: [risk, ...state.risks] };
    }

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

    case "simulation/setCanonicalId": {
      const { id } = action.payload;
      const current = state.simulation.current
        ? { ...state.simulation.current, id }
        : undefined;
      const scenarioSnapshots = state.simulation.scenarioSnapshots?.neutral
        ? {
            ...state.simulation.scenarioSnapshots,
            neutral: { ...state.simulation.scenarioSnapshots.neutral, id },
          }
        : state.simulation.scenarioSnapshots;
      return {
        ...state,
        simulation: {
          ...state.simulation,
          current,
          ...(scenarioSnapshots != null && { scenarioSnapshots }),
        },
      };
    }

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
  /** Soft-delete: sets status to Archived (persists on save). */
  archiveRisk: (id: string) => void;
  /** Restore archived risk to Open (persists on save). */
  restoreArchivedRisk: (id: string) => void;
  clearRisks: () => void;
  simulation: State["simulation"];
  runSimulation: (iterations?: number, projectId?: string) => Promise<RunSimulationResult>;
  clearSimulationHistory: () => void;
  /** Restore simulation state from a DB snapshot row (e.g. after loading getLatestSnapshot). */
  hydrateSimulationFromDbSnapshot: (row: SimulationSnapshotRow) => void;
  setSimulationDelta: (delta: SimulationDelta | null) => void;
  /** True when any risk has status "draft"; simulation must not run until user saves drafts to open. */
  hasDraftRisks: boolean;
  /** Count of runnable (non-draft, non-closed, non-archived) risks that fail runnable validation. */
  invalidRunnableCount: number;
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

  // Hydrate once: restore simulation only from localStorage. Risks are loaded from Supabase as single source of truth (see risk-register page).
  useEffect(() => {
    const saved = loadState<PersistedState | { risks?: unknown[]; simulation?: { current?: SimulationSnapshot; history?: SimulationSnapshot[] } }>(STORAGE_KEY);
    if (!saved || typeof saved !== "object") return;
    const sim = "simulation" in saved && saved.simulation && Array.isArray((saved.simulation as PersistedState["simulation"]).history) ? saved.simulation as PersistedState["simulation"] : null;
    if (sim) {
      const ensureP20 = (s: SimulationSnapshot | undefined): SimulationSnapshot | undefined => {
        if (!s) return s;
        if (typeof (s as SimulationSnapshot & { p20Cost?: number }).p20Cost === "number") return s as SimulationSnapshot;
        return { ...s, p20Cost: (s as SimulationSnapshot).p50Cost ?? 0 } as SimulationSnapshot;
      };
      dispatch({
        type: "simulation/hydrate",
        payload: {
          current: ensureP20(sim.current) ?? sim.current,
          history: (sim.history ?? []).map((h) => ensureP20(h) ?? h),
          scenarioSnapshots: sim.scenarioSnapshots,
          neutral: sim.neutral,
          seed: sim.seed,
        },
      });
    }
  }, []);

  // Persist on change (risks + simulation). Depend on state.simulation (object reference from reducer) so we re-run when simulation updates; no dispatch in effect so no loop.
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
  }, [state.risks, state.simulation]);

  // Sync simulation context to server (same as Outputs: neutral = scenarioSnapshots?.neutral ?? current). Depend on state.simulation so we re-run when it updates; no dispatch in effect so no loop.
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
  }, [state.risks, state.simulation]);

  const { profile: projectionProfile } = useProjectionScenario();

  // Canonical forecast update: when simulation/risks or profile change, push decision scores into snapshot history once per run (Day 8 input), then build and store forecast map. Deps use stable primitives (simCurrentTs, simHistoryLen) to avoid state/state.simulation and prevent effect loop (effect dispatches riskForecasts/set).
  const simCurrentTs = state.simulation.current?.timestampIso ?? null;
  const simHistoryLen = state.simulation.history?.length ?? 0;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable primitives only; adding state would cause loop (effect dispatches)
  }, [state.risks, simCurrentTs, simHistoryLen, projectionProfile]);

  const riskForecastsById = state.riskForecastsById;
  const invalidRunnableCount = useMemo(() => {
    const runnable = state.risks.filter(
      (r) =>
        !isRiskStatusDraft(r.status) && !isRiskStatusClosed(r.status) && !isRiskStatusArchived(r.status)
    );
    return runnable.filter((r) => !isRiskValid(r)).length;
  }, [state.risks]);

  const forwardPressure = useMemo(() => {
    const list = Object.values(riskForecastsById);
    const profile = list[0]?.projectionProfileUsed;
    return computePortfolioForwardPressure(list, profile);
  }, [riskForecastsById]);

  const hydrateSimulationFromDbSnapshot = useCallback((row: SimulationSnapshotRow) => {
    const built = buildSimulationFromDbRow(row);
    if (built) {
      dispatch({
        type: "simulation/hydrate",
        payload: {
          current: built.current,
          history: [],
          neutral: built.neutral,
        },
      });
    }
  }, [dispatch]);

  const value = useMemo<Ctx>(
    () => ({
      risks: state.risks,
      addRisk: (risk) => dispatch({ type: "risk/add", risk }),
      setRisks: (risks) => dispatch({ type: "risks/set", risks }),
      appendRisks: (risks) => dispatch({ type: "risks/append", risks }),
      updateRisk: (id, patch) => dispatch({ type: "risk/update", id, patch }),
      updateRatingPc: (id, target, payload) =>
        dispatch({ type: "RISK_UPDATE_RATING_PC", payload: { id, target, ...payload } }),
      archiveRisk: (id) => {
        console.log("[risks] archived (local store)", { riskId: id, status: RISK_STATUS_ARCHIVED_LOOKUP });
        dispatch({ type: "risk/update", id, patch: { status: RISK_STATUS_ARCHIVED_LOOKUP } });
      },
      restoreArchivedRisk: (id) => {
        console.log("[risks] restored from archive (local store)", { riskId: id, status: RISK_STATUS_OPEN_LOOKUP });
        dispatch({ type: "risk/update", id, patch: { status: RISK_STATUS_OPEN_LOOKUP } });
      },
      clearRisks: () => dispatch({ type: "risks/clear" }),
      simulation: state.simulation,
      runSimulation: (iterations, projectIdFromCaller) => {
        const hasDraft = state.risks.some((r) => isRiskStatusDraft(r.status));
        if (hasDraft) return Promise.resolve({ ran: false, blockReason: "draft" });
        const runnable = state.risks.filter(
          (r) => !isRiskStatusClosed(r.status) && !isRiskStatusArchived(r.status)
        );
        const invalidCount = runnable.filter((r) => !isRiskValid(r)).length;
        if (invalidCount > 0) {
          return Promise.resolve({ ran: false, blockReason: "invalid", invalidCount });
        }
        const iterCount = iterations ?? 10000;
        const seed =
          state.simulation.seed != null
            ? state.simulation.seed
            : Math.random() * 0xffffffff;

        const runStartMs = typeof performance !== "undefined" ? performance.now() : Date.now();

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
          id: "", // Pending; replaced by riskai_simulation_snapshots.id after successful persist
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

        const effectiveRisks = state.risks.filter(
          (r) => !isRiskStatusClosed(r.status) && !isRiskStatusArchived(r.status)
        );
        const conservativeRisks = effectiveRisks.map((r) =>
          applyScenarioToRiskInputs(r, "conservative")
        );
        const aggressiveRisks = effectiveRisks.map((r) =>
          applyScenarioToRiskInputs(r, "aggressive")
        );
        const scenarioSnapshots: ScenarioSnapshotsMap = {
          neutral: neutralSnapshot,
          conservative: simulatePortfolio(conservativeRisks, iterCount, {
            profile: "conservative",
          }),
          aggressive: simulatePortfolio(aggressiveRisks, iterCount, { profile: "aggressive" }),
        };
        const runDurationMs =
          (typeof performance !== "undefined" ? performance.now() : Date.now()) - runStartMs;
        const runDurationRounded = Math.round(runDurationMs * 100) / 100;
        const snapshotWithDuration: SimulationSnapshot = {
          ...neutralSnapshot,
          runDurationMs: runDurationRounded,
        };
        scenarioSnapshots.neutral = snapshotWithDuration;

        const nextHistoryRaw = [snapshotWithDuration, ...state.simulation.history].slice(
          0,
          SIMULATION_HISTORY_CAP
        );
        const enrichedForPersist = enrichSnapshotWithIntelligenceMetrics(
          snapshotWithDuration,
          nextHistoryRaw
        );

        const inputsUsed = neutralRisks
          .map((r) => {
            const inp = getEffectiveRiskInputs(r);
            if (!inp) return null;
            return {
              risk_id: r.id,
              title: r.title,
              source_used: inp.sourceUsed,
              probability: inp.probability,
              cost_ml: inp.costML,
              time_ml: inp.timeML,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);

        const distributions = {
          costHistogram: binSamplesIntoHistogram(mcResult.costSamples, SNAPSHOT_DISTRIBUTION_BINS),
          timeHistogram: binSamplesIntoTimeHistogram(mcResult.timeSamples, SNAPSHOT_DISTRIBUTION_BINS),
          binCount: SNAPSHOT_DISTRIBUTION_BINS,
        };

        const payload: SimulationSnapshotPayload = {
          summary: { ...mcResult.summary },
          summaryReport: { ...summaryReport },
          risks: enrichedForPersist.risks,
          distributions,
          seed,
          inputs_used: inputsUsed,
          scenario_outputs: {
            conservative: scenarioSnapshotScalarsForPayload(scenarioSnapshots.conservative),
            aggressive: scenarioSnapshotScalarsForPayload(scenarioSnapshots.aggressive),
          },
        };

        const s = mcResult.summary;
        let snapshotProjectId: string | undefined = projectIdFromCaller ?? undefined;
        if (snapshotProjectId == null && typeof window !== "undefined") {
          try {
            const fromStorage = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
            snapshotProjectId = fromStorage ?? undefined;
          } catch {
            // localStorage unavailable (e.g. private browsing)
          }
        }
        const snapshotPromise = createSnapshot(
          {
            iterations: iterCount,
            cost_p20: s.p20Cost,
            cost_p50: s.p50Cost,
            cost_p80: s.p80Cost,
            cost_p90: s.p90Cost,
            cost_mean: s.meanCost,
            cost_min: s.minCost,
            cost_max: s.maxCost,
            time_p20: s.p20Time,
            time_p50: s.p50Time,
            time_p80: s.p80Time,
            time_p90: s.p90Time,
            time_mean: s.meanTime,
            time_min: s.minTime,
            time_max: s.maxTime,
            risk_count: enrichedForPersist.risks.length,
            engine_version: SIMULATION_ENGINE_VERSION,
            run_duration_ms: runDurationRounded,
            payload,
          },
          snapshotProjectId
        );
        dispatch({
          type: "simulation/run",
          payload: { snapshot: snapshotWithDuration, scenarioSnapshots, neutral },
        });
        const previous = state.simulation.current;
        if (previous) {
          dispatch({
            type: "simulation/setDelta",
            delta: calculateDelta(previous, snapshotWithDuration),
          });
        }
        return snapshotPromise
          .then((row) => {
            if (row?.id) dispatch({ type: "simulation/setCanonicalId", payload: { id: row.id } });
            return { ran: true } as const;
          })
          .catch((e: unknown) => {
            console.error("[snapshots]", e);
            const message =
              e &&
              typeof e === "object" &&
              "message" in e &&
              typeof (e as { message: unknown }).message === "string"
                ? (e as { message: string }).message
                : String(e);
            // Monte Carlo already ran and state was updated; surface persist failure without blocking UI.
            return { ran: true as const, snapshotPersistWarning: message };
          });
      },
      clearSimulationHistory: () => dispatch({ type: "simulation/clearHistory" }),
      hydrateSimulationFromDbSnapshot,
      setSimulationDelta: (delta) => dispatch({ type: "simulation/setDelta", delta }),
      hasDraftRisks: state.risks.some((r) => isRiskStatusDraft(r.status)),
      invalidRunnableCount,
      forwardPressure,
      riskForecastsById,
    }),
    [
      state.risks,
      state.simulation,
      invalidRunnableCount,
      forwardPressure,
      riskForecastsById,
      hydrateSimulationFromDbSnapshot,
    ]
  );

  return <RiskRegisterContext.Provider value={value}>{children}</RiskRegisterContext.Provider>;
}

export function useRiskRegister(): Ctx {
  const ctx = useContext(RiskRegisterContext);
  if (!ctx) throw new Error("useRiskRegister must be used within RiskRegisterProvider");
  return ctx;
}