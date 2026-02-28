import type { AppliesTo } from "@/domain/risk/risk.schema";

export const OWNER_OPTIONS = [
  "Unassigned",
  "Project Manager",
  "Risk Owner",
  "Engineering",
  "Construction",
  "Procurement",
  "Commercial",
  "Other",
] as const;

export const APPLIES_TO_OPTIONS: { value: AppliesTo; label: string }[] = [
  { value: "time", label: "Time" },
  { value: "cost", label: "Cost" },
  { value: "both", label: "Both" },
];
