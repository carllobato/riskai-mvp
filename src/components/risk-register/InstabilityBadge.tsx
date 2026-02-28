"use client";

import { useRef, useState, useEffect } from "react";
import type { InstabilityResult } from "@/types/instability";
import type { ScenarioLensMode, ScenarioName } from "@/lib/instability/selectScenarioLens";
import type { RiskWithInstability } from "@/lib/instability/selectScenarioLens";
import type { UiMode } from "@/context/ProjectionScenarioContext";
import { LensDebugIcon } from "@/components/debug/LensDebugIcon";

const badgeBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 5px",
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.02em",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

function badgeStyleForLevel(level: InstabilityResult["level"]): React.CSSProperties {
  switch (level) {
    case "Low":
      return {
        ...badgeBaseStyle,
        backgroundColor: "rgba(128, 128, 128, 0.14)",
        color: "var(--foreground)",
        opacity: 0.9,
      };
    case "Moderate":
      return {
        ...badgeBaseStyle,
        backgroundColor: "rgba(234, 179, 8, 0.2)",
        color: "#a16207",
      };
    case "High":
      return {
        ...badgeBaseStyle,
        backgroundColor: "rgba(249, 115, 22, 0.2)",
        color: "#c2410c",
      };
    case "Critical":
      return {
        ...badgeBaseStyle,
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        color: "#b91c1c",
      };
    default:
      return { ...badgeBaseStyle, backgroundColor: "rgba(128, 128, 128, 0.14)", color: "var(--foreground)" };
  }
}

/** Meeting-mode level label: Stable | Moderate | Elevated | Critical */
const meetingLevelLabel: Record<InstabilityResult["level"], string> = {
  Low: "Stable",
  Moderate: "Moderate",
  High: "Elevated",
  Critical: "Critical",
};

export function InstabilityBadge({
  instability,
  lensUsed,
  manualScenario,
  lensMode,
  uiMode = "Meeting",
}: {
  instability: InstabilityResult | undefined;
  /** Risk Register only: show "Lens used" in tooltip for debug (Diagnostic only). */
  lensUsed?: ScenarioName;
  manualScenario?: ScenarioName;
  lensMode?: ScenarioLensMode;
  uiMode?: UiMode;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!instability) {
    return (
      <span style={{ ...badgeBaseStyle, cursor: "default", backgroundColor: "transparent", color: "#a3a3a3" }}>
        EII —
      </span>
    );
  }

  const { index, level, breakdown, recommendedScenario, rationale, flags, momentum } = instability;
  const style = badgeStyleForLevel(level);
  const showMomentumIcon = uiMode === "Diagnostic";
  const momentumIcon = showMomentumIcon && (momentum === "Rising" ? "↑" : momentum === "Falling" ? "↓" : null);
  const isMeeting = uiMode === "Meeting";
  const badgeLabel = isMeeting ? `EII ${index} · ${meetingLevelLabel[level]}` : `EII ${index}`;

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 2 }}>
      <button
        type="button"
        style={{ ...style, minWidth: isMeeting ? 72 : undefined }}
        onClick={() => !isMeeting && setOpen((o) => !o)}
        title={isMeeting ? `Escalation Instability Index: ${meetingLevelLabel[level]}` : "Escalation Instability Index — click for details"}
        aria-expanded={isMeeting ? false : open}
        aria-haspopup={isMeeting ? undefined : "dialog"}
      >
        {badgeLabel}
      </button>
      {momentumIcon != null && (
        <span style={{ fontSize: 10, opacity: 0.75, color: "var(--foreground)" }} title={momentum === "Rising" ? "EII rising vs last run" : "EII falling vs last run"} aria-hidden>
          {momentumIcon}
        </span>
      )}
      {open && !isMeeting && (
        <div
          role="dialog"
          aria-label="EII breakdown"
          style={{
            position: "absolute",
            left: 0,
            top: "100%",
            marginTop: 4,
            zIndex: 50,
            minWidth: 260,
            maxWidth: 320,
            padding: 12,
            background: "var(--background)",
            border: "1px solid var(--border, #e5e5e5)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            fontSize: 12,
            color: "var(--foreground)",
            textAlign: "left",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
            Level: {level}
          </div>
          {uiMode === "Diagnostic" && (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 500, marginBottom: 4, color: "var(--foreground)", opacity: 0.9 }}>Breakdown</div>
                <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
                  <li>velocityScore: {(breakdown.velocityScore * 100).toFixed(0)}%</li>
                  <li>volatilityScore: {(breakdown.volatilityScore * 100).toFixed(0)}%</li>
                  <li>sensitivityScore: {(breakdown.sensitivityScore * 100).toFixed(0)}%</li>
                  <li>confidencePenalty: {(breakdown.confidencePenalty * 100).toFixed(0)}%</li>
                  <li>momentumPenalty: {(breakdown.momentumPenalty * 100).toFixed(0)}%</li>
                </ul>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Weights</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
                  {Object.entries(breakdown.weights).map(([k, v]) => (
                    <span key={k} style={{ opacity: 0.85 }}>
                      {k}: {(v * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Recommended scenario</div>
            <div style={{ opacity: 0.9 }}>{recommendedScenario}</div>
          </div>
          {uiMode === "Diagnostic" && lensUsed != null && (
            <div style={{ marginBottom: 8, fontSize: 11, color: "var(--foreground)", opacity: 0.8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>
                Lens used: {lensUsed}
                {manualScenario != null ? ` (Manual: ${manualScenario})` : ""}
              </span>
              {lensMode != null && manualScenario != null && (
                <LensDebugIcon
                  risk={{ instability } as RiskWithInstability}
                  lensMode={lensMode}
                  manualScenario={manualScenario}
                  uiMode={uiMode}
                />
              )}
            </div>
          )}
          {rationale.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Rationale</div>
              <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
                {rationale.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {uiMode === "Diagnostic" && flags.length > 0 && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Flags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {flags.map((f) => (
                  <span
                    key={f}
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      backgroundColor: "rgba(128, 128, 128, 0.15)",
                      color: "var(--foreground)",
                      opacity: 0.9,
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
