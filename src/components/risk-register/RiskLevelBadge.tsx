"use client";

import type { RiskLevel } from "@/domain/risk/risk.schema";

export const LEVEL_STYLES: Record<
  RiskLevel,
  { bg: string; dot: string; text: string }
> = {
  low: { bg: "rgba(34, 197, 94, 0.12)", dot: "#16a34a", text: "#15803d" },
  medium: { bg: "rgba(234, 179, 8, 0.14)", dot: "#ca8a04", text: "#a16207" },
  high: { bg: "rgba(239, 68, 68, 0.12)", dot: "#dc2626", text: "#b91c1c" },
  extreme: { bg: "rgba(127, 29, 29, 0.2)", dot: "#991b1b", text: "#7f1d1d" },
};

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const s = LEVEL_STYLES[level];
  const label = level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: s.bg,
        color: s.text,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          backgroundColor: s.dot,
        }}
      />
      {label}
    </span>
  );
}
