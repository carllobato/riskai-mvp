"use client";

import { getLensDebug } from "@/lib/instability/lensDebug";
import type { ScenarioLensMode, ScenarioName } from "@/lib/instability/selectScenarioLens";
import type { RiskWithInstability } from "@/lib/instability/selectScenarioLens";
import type { UiMode } from "@/context/ProjectionScenarioContext";

type PerRiskProps = {
  risk: RiskWithInstability;
  lensMode: ScenarioLensMode;
  manualScenario: ScenarioName;
  uiMode?: UiMode;
};

type AggregateProps = {
  lensMode: ScenarioLensMode;
  manualScenario: ScenarioName;
  /** When true, show aggregate tooltip (Outputs page). */
  aggregate?: true;
  uiMode?: UiMode;
};

/**
 * Tiny debug icon shown next to scenario-driven values when lens is Auto.
 * Only visible when uiMode === "Debug". Use title for tooltip.
 */
export function LensDebugIcon(props: PerRiskProps | AggregateProps) {
  const uiMode = "uiMode" in props ? props.uiMode : undefined;
  if (uiMode !== "Debug") return null;

  const isAggregate = "aggregate" in props && props.aggregate === true;
  const lensMode = props.lensMode;
  const manualScenario = props.manualScenario;

  if (lensMode !== "Auto" && !isAggregate) return null;

  if (isAggregate) {
    const tooltip =
      lensMode === "Auto"
        ? "Auto aggregation: per-risk lens"
        : `Manual aggregation: ${manualScenario}`;
    return (
      <span
        className="inline-flex items-center align-middle ml-1"
        title={tooltip}
        aria-hidden
      >
        <span
          className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 opacity-60"
          style={{ minWidth: 6, minHeight: 6 }}
        />
      </span>
    );
  }

  const { risk } = props as PerRiskProps;
  const { scenarioToUse, differsFromManual, isAuto } = getLensDebug(
    risk,
    lensMode,
    manualScenario
  );

  if (!isAuto) return null;

  const recommended = risk.instability?.recommendedScenario ?? "—";
  const tooltip = `Mode: ${lensMode} · Manual: ${manualScenario} · Used: ${scenarioToUse} · Differs: ${differsFromManual ? "yes" : "no"} · Recommended: ${recommended}`;

  return (
    <span
      className="inline-flex items-center align-middle ml-1 shrink-0"
      title={tooltip}
      aria-hidden
    >
      <span
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          minWidth: 6,
          minHeight: 6,
          backgroundColor: differsFromManual
            ? "var(--foreground)"
            : "var(--foreground)",
          opacity: differsFromManual ? 0.85 : 0.35,
        }}
      />
    </span>
  );
}
