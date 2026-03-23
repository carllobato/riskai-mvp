/** Neutral-only projection profile. */
export type ProjectionProfile = "neutral";

export type ProjectionParams = {
  momentumDecay: number;
  confidenceDecay: number;
};

/** Neutral = current engine defaults (no output change by default). */
const NEUTRAL_MOMENTUM_DECAY = 0.85;
const NEUTRAL_CONFIDENCE_DECAY = 0.92;

/** Safe bounds: profile decay multipliers must be within 0.5x–1.5x of neutral to prevent runaway amplification. */
const DECAY_MULTIPLIER_MIN = 0.5;
const DECAY_MULTIPLIER_MAX = 1.5;

function clampToSafeDecay(
  value: number,
  neutral: number,
  name: string,
  profile: ProjectionProfile
): number {
  const min = neutral * DECAY_MULTIPLIER_MIN;
  const max = neutral * DECAY_MULTIPLIER_MAX;
  if (value < min || value > max) {
    throw new Error(
      `[projectionProfiles] Profile "${profile}" ${name} ${value} is outside safe bounds [${min.toFixed(3)}, ${max.toFixed(3)}] (0.5x–1.5x of neutral ${neutral}). Refactor may have broken projection integrity.`
    );
  }
  return value;
}

const PROJECTION_PROFILE_CONFIG: Record<ProjectionProfile, ProjectionParams> = {
  neutral: {
    momentumDecay: clampToSafeDecay(NEUTRAL_MOMENTUM_DECAY, NEUTRAL_MOMENTUM_DECAY, "momentumDecay", "neutral"),
    confidenceDecay: clampToSafeDecay(NEUTRAL_CONFIDENCE_DECAY, NEUTRAL_CONFIDENCE_DECAY, "confidenceDecay", "neutral"),
  },
};

/**
 * Returns the final params used by the projection engine (decay, persistence).
 * Use these when calling projectForward or building forecasts.
 * Throws if profile config exceeds safe decay bounds (0.5x–1.5x of neutral).
 */
export function getProjectionParams(profile: ProjectionProfile): ProjectionParams {
  return { ...PROJECTION_PROFILE_CONFIG[profile] };
}
