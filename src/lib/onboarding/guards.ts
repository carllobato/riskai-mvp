import { OnboardingMetaKey } from "./types";

export type UserMetadata = Record<string, unknown> | undefined;

export type AccountProfileFields = {
  first_name?: string | null;
  /** `public.profiles.surname` */
  surname?: string | null;
  /** Legacy metadata / forms only */
  last_name?: string | null;
  company?: string | null;
};

function mergedAccountField(
  profile: AccountProfileFields | null | undefined,
  meta: UserMetadata,
  key: keyof AccountProfileFields,
): string {
  const p = profile?.[key];
  if (typeof p === "string" && p.trim().length > 0) return p.trim();
  const m = meta?.[key];
  if (typeof m === "string" && m.trim().length > 0) return m.trim();
  return "";
}

function mergedSurname(
  profile: AccountProfileFields | null | undefined,
  meta: UserMetadata,
): string {
  const fromProfile =
    (typeof profile?.surname === "string" && profile.surname.trim()) ||
    (typeof profile?.last_name === "string" && profile.last_name.trim());
  if (fromProfile) return fromProfile;
  const mLast = meta?.last_name;
  if (typeof mLast === "string" && mLast.trim().length > 0) return mLast.trim();
  const mSur = meta?.surname;
  if (typeof mSur === "string" && mSur.trim().length > 0) return mSur.trim();
  return "";
}

/**
 * Same bar as Settings: first name, surname, and company required (`public.profiles` and/or legacy metadata).
 */
export function isOnboardingProfileComplete(
  meta: UserMetadata,
  profile?: AccountProfileFields | null,
): boolean {
  const first = mergedAccountField(profile, meta, "first_name");
  const last = mergedSurname(profile, meta);
  const company = mergedAccountField(profile, meta, "company");
  return first.length > 0 && last.length > 0 && company.length > 0;
}

export function isPortfolioOnboardingSkipped(meta: UserMetadata): boolean {
  return meta?.[OnboardingMetaKey.portfolioSkipped] === true;
}

export function isOnboardingWizardComplete(meta: UserMetadata): boolean {
  return meta?.[OnboardingMetaKey.wizardComplete] === true;
}
