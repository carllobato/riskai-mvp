import "server-only";

type RequiredEnvKey =
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "OPENAI_API_KEY"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

type OptionalNumberEnvKey = "AI_RATE_LIMIT_MAX" | "AI_RATE_LIMIT_WINDOW_SEC";

function requiredString(name: RequiredEnvKey): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalPositiveInt(name: OptionalNumberEnvKey): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer, received "${raw}"`);
  }
  return parsed;
}

function optionalBooleanFlag(name: "PORTFOLIO_INVITE_DEBUG"): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return false;

  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;

  throw new Error(
    `Invalid ${name}: expected one of 1,true,yes,on,0,false,no,off; received "${raw}"`
  );
}

export type Env = {
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly OPENAI_API_KEY: string;
  readonly NEXT_PUBLIC_SUPABASE_URL: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  readonly AI_RATE_LIMIT_MAX: number | undefined;
  readonly AI_RATE_LIMIT_WINDOW_SEC: number | undefined;
  readonly PORTFOLIO_INVITE_DEBUG: boolean;
};

export const env: Env = {
  get SUPABASE_SERVICE_ROLE_KEY() {
    return requiredString("SUPABASE_SERVICE_ROLE_KEY");
  },
  get OPENAI_API_KEY() {
    return requiredString("OPENAI_API_KEY");
  },
  get NEXT_PUBLIC_SUPABASE_URL() {
    return requiredString("NEXT_PUBLIC_SUPABASE_URL");
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return requiredString("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get AI_RATE_LIMIT_MAX() {
    return optionalPositiveInt("AI_RATE_LIMIT_MAX");
  },
  get AI_RATE_LIMIT_WINDOW_SEC() {
    return optionalPositiveInt("AI_RATE_LIMIT_WINDOW_SEC");
  },
  get PORTFOLIO_INVITE_DEBUG() {
    return optionalBooleanFlag("PORTFOLIO_INVITE_DEBUG");
  },
};
