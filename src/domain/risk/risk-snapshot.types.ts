/**
 * Snapshot of a risk at a point in time (cycle) for history and trends.
 */

export type RiskSnapshot = {
  riskId: string;
  cycleIndex: number;
  timestamp: string; // ISO datetime
  compositeScore: number; // 0–100
  mitigatedScore?: number; // 0–100, optional
  momentum?: number; // optional
};
