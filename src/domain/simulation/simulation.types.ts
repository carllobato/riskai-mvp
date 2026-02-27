export type SimulationRiskSnapshot = {
  id: string;
  title: string;
  category?: string;
  expectedCost: number;
  expectedDays: number;
  simMeanCost: number;
  simMeanDays: number;
  /** Day 5 intelligence (backend-only) */
  simStdDev?: number;
  triggerRate?: number;
  velocity?: number;
  volatility?: number;
  stability?: number;
};

export type SimulationSnapshot = {
  id: string;
  timestampIso: string;
  iterations: number;
  p50Cost: number;
  p80Cost: number;
  p90Cost: number;
  totalExpectedCost: number;
  totalExpectedDays: number;
  risks: SimulationRiskSnapshot[];
  /** Day 5 intelligence (backend-only) */
  simStdDev?: number;
  triggerRate?: number;
  velocity?: number;
  volatility?: number;
  stability?: number;
};

export type SimulationRiskDelta = {
  id: string;
  title: string;
  category?: string;
  prevExpectedCost: number;
  currExpectedCost: number;
  deltaCost: number;
  deltaCostPct: number;
  prevExpectedDays: number;
  currExpectedDays: number;
  deltaDays: number;
  deltaDaysPct: number;
  direction: "up" | "down" | "flat";
};

export type SimulationDelta = {
  portfolioDeltaCost: number;
  portfolioDeltaCostPct: number;
  portfolioDeltaDays: number;
  portfolioDeltaDaysPct: number;
  riskDeltas: SimulationRiskDelta[];
};
