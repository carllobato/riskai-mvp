/**
 * Onboarding metadata keys (Supabase `user.user_metadata`).
 * Name + company in `public.users`; optional job title (`role`) + step flags in metadata.
 * Keep step IDs stable so guided tours / checklists can layer on later.
 */
export const OnboardingMetaKey = {
  profileComplete: "onboarding_profile_complete",
  /** User chose to continue without creating a portfolio during onboarding. */
  portfolioSkipped: "onboarding_portfolio_skipped",
  /** First-run portfolio → project wizard finished (dashboard unlocked). */
  wizardComplete: "onboarding_wizard_complete",
  /** Optional job title / function — stored in metadata. */
  role: "role",
} as const;

/** Dispatched on `window` after first name / surname / company are saved (settings or welcome modal). */
export const ACCOUNT_PROFILE_UPDATED_EVENT = "riskai-account-profile-updated";

/** Future: drive checklist / product tours without renaming routes. */
export type OnboardingStepId = "profile" | "portfolio" | "dashboard";
