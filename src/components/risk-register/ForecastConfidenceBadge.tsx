"use client";

/**
 * Compact confidence badge for forecast signal quality (contextual only).
 * Low <40, Medium 40–69, High ≥70. Respects dark/light theme.
 */

type ConfidenceBand = "low" | "medium" | "high";

function getBand(score: number): ConfidenceBand {
  if (score < 40) return "low";
  if (score < 70) return "medium";
  return "high";
}

const badgeBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "2px 5px",
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.02em",
};

function badgeStyleForBand(band: ConfidenceBand): React.CSSProperties {
  if (band === "low") {
    return {
      ...badgeBaseStyle,
      color: "var(--foreground)",
      opacity: 0.78,
      backgroundColor: "rgba(128, 128, 128, 0.14)",
    };
  }
  if (band === "medium") {
    return {
      ...badgeBaseStyle,
      color: "var(--foreground)",
      opacity: 0.88,
      backgroundColor: "transparent",
    };
  }
  return {
    ...badgeBaseStyle,
    color: "var(--foreground)",
    opacity: 1,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  };
}

export function ForecastConfidenceBadge({
  forecastConfidence,
  insufficientHistory,
}: {
  forecastConfidence?: number;
  insufficientHistory?: boolean;
}) {
  const hasValue = typeof forecastConfidence === "number" && Number.isFinite(forecastConfidence);
  const band = hasValue ? getBand(forecastConfidence!) : "low";
  const style = badgeStyleForBand(band);
  const label = hasValue ? `Conf ${Math.round(forecastConfidence!)}%` : "Conf —";
  const tooltip = insufficientHistory
    ? "Forecast Confidence: insufficient history."
    : "Forecast Confidence: Based on history depth, momentum stability, and volatility.";

  return (
    <span
      style={style}
      title={tooltip}
      className="shrink-0"
    >
      {band === "low" && (
        <span
          style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "currentColor", opacity: 0.8 }}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}
