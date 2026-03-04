"use client";

import { useRef, useState, useEffect } from "react";
import type { InstabilityResult } from "@/types/instability";

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

/** Level label: Stable | Moderate | Elevated | Critical */
const levelLabel: Record<InstabilityResult["level"], string> = {
  Low: "Stable",
  Moderate: "Moderate",
  High: "Elevated",
  Critical: "Critical",
};

export function InstabilityBadge({
  instability,
}: {
  instability: InstabilityResult | undefined;
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

  const { index, level, recommendedScenario, rationale } = instability;
  const style = badgeStyleForLevel(level);
  const badgeLabel = `EII ${index} · ${levelLabel[level]}`;

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 2 }}>
      <button
        type="button"
        style={{ ...style, minWidth: 72 }}
        onClick={() => setOpen((o) => !o)}
        title={`Escalation Instability Index: ${levelLabel[level]}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {badgeLabel}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="EII details"
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
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Recommended scenario</div>
            <div style={{ opacity: 0.9 }}>{recommendedScenario}</div>
          </div>
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
        </div>
      )}
    </div>
  );
}
