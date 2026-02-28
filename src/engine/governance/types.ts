/**
 * Governance engine — placeholder types.
 * Day 11/12: governance indicators (e.g. meeting status, EII level).
 */

/** Single governance status for Meeting mode (aligned with RiskRegisterRow). */
export type MeetingStatus = "Stable" | "Escalating" | "At Risk" | "Critical";

/** Placeholder: EII / instability level used in governance views. */
export type GovernanceInstabilityLevel = "Low" | "Moderate" | "High" | "Critical";
