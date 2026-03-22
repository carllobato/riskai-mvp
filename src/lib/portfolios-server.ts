import {
  portfolioMemberRoleAllowsSettingsPageAccess,
  resolvePortfolioMemberCapabilityFlags,
  type PortfolioMemberCapabilityFlags,
} from "@/lib/db/portfolioMemberAccess";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessiblePortfolio = {
  id: string;
  name: string;
  created_at: string | null;
};

/** Full portfolio row for admin (includes owner_user_id, description, product). */
export type PortfolioForAdmin = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  product_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PortfolioMemberRow = {
  id: string;
  portfolio_id: string;
  user_id: string;
  role: string;
  created_at: string | null;
};

export type AssertPortfolioAdminOk = {
  portfolio: PortfolioForAdmin;
} & PortfolioMemberCapabilityFlags;
export type AssertPortfolioAdminDenied =
  | { error: "unauthorized" }
  | { error: "forbidden" }
  | { error: "not_found" };
export type AssertPortfolioAdminResult =
  | AssertPortfolioAdminOk
  | AssertPortfolioAdminDenied;

/**
 * Server-only. Verifies the user may open portfolio settings: table owner, or portfolio_members with
 * owner / editor / viewer (non-members denied). Sets canEditPortfolioDetails for name/description edits.
 */
export async function assertPortfolioAdminAccess(
  portfolioId: string,
  supabase: SupabaseClient,
  userId: string
): Promise<AssertPortfolioAdminResult> {
  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id, name, description, owner_user_id, product_id, created_at, updated_at")
    .eq("id", portfolioId)
    .single();

  if (portfolioError || !portfolio) {
    return { error: "not_found" };
  }

  const shaped: PortfolioForAdmin = {
    id: portfolio.id,
    name: portfolio.name,
    description: portfolio.description ?? null,
    owner_user_id: portfolio.owner_user_id,
    product_id: portfolio.product_id ?? null,
    created_at: portfolio.created_at ?? null,
    updated_at: portfolio.updated_at ?? null,
  };

  const isTableOwner = portfolio.owner_user_id === userId;

  const { data: membership } = await supabase
    .from("portfolio_members")
    .select("role")
    .eq("portfolio_id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  const rowRole = membership?.role as string | undefined;

  if (isTableOwner) {
    const caps = resolvePortfolioMemberCapabilityFlags(true, rowRole);
    return { portfolio: shaped, ...caps };
  }

  if (!membership || !portfolioMemberRoleAllowsSettingsPageAccess(rowRole)) {
    return { error: "forbidden" };
  }

  const caps = resolvePortfolioMemberCapabilityFlags(false, rowRole);
  return { portfolio: shaped, ...caps };
}

export type GetAccessiblePortfoliosResult =
  | { ok: true; portfolios: AccessiblePortfolio[] }
  | { ok: false; error: string };

/**
 * Server-only: returns portfolios the given user can access (owner or member).
 * Same access logic as GET /api/portfolios — use this from API and server components
 * so behaviour never drifts.
 */
export async function getAccessiblePortfolios(
  supabase: SupabaseClient,
  userId: string
): Promise<GetAccessiblePortfoliosResult> {
  const { data: portfolios, error } = await supabase
    .from("portfolios")
    .select("id, name, created_at, owner_user_id")
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data: memberships } = await supabase
    .from("portfolio_members")
    .select("portfolio_id")
    .eq("user_id", userId);

  const memberPortfolioIds = new Set(
    (memberships ?? []).map((m) => m.portfolio_id)
  );

  const allowed = (portfolios ?? []).filter(
    (p) => p.owner_user_id === userId || memberPortfolioIds.has(p.id)
  );

  const list = allowed.map(({ id, name, created_at }) => ({
    id,
    name,
    created_at: created_at ?? null,
  }));

  return { ok: true, portfolios: list };
}

export type AccessibleProject = {
  id: string;
  name: string;
  created_at: string | null;
};

export type GetAccessibleProjectsResult =
  | { ok: true; projects: AccessibleProject[] }
  | { ok: false; error: string };

/**
 * Server-only: projects the user may see — table owner, `project_members`, or projects in a portfolio
 * they can access. Uses explicit queries so behaviour matches getAccessiblePortfolios; RLS still applies.
 */
export async function getAccessibleProjects(
  supabase: SupabaseClient,
  userId: string,
  accessiblePortfolioIds: string[]
): Promise<GetAccessibleProjectsResult> {
  const { data: ownedProjects, error: ownedError } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });

  if (ownedError) {
    return { ok: false, error: ownedError.message };
  }

  const { data: memberRows, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);

  if (memberError) {
    return { ok: false, error: memberError.message };
  }

  const memberProjectIds = [
    ...new Set((memberRows ?? []).map((r) => r.project_id as string)),
  ];

  let memberProjects: { id: string; name: string | null; created_at: string | null }[] = [];
  if (memberProjectIds.length > 0) {
    const { data, error: mpError } = await supabase
      .from("projects")
      .select("id, name, created_at")
      .in("id", memberProjectIds)
      .order("created_at", { ascending: true });

    if (mpError) {
      return { ok: false, error: mpError.message };
    }
    memberProjects = data ?? [];
  }

  let sharedProjects: { id: string; name: string | null; created_at: string | null }[] = [];
  if (accessiblePortfolioIds.length > 0) {
    const { data, error: sharedError } = await supabase
      .from("projects")
      .select("id, name, created_at")
      .in("portfolio_id", accessiblePortfolioIds)
      .order("created_at", { ascending: true });

    if (sharedError) {
      return { ok: false, error: sharedError.message };
    }
    sharedProjects = data ?? [];
  }

  const rowToAccessible = (p: { id: string; name: string | null; created_at: string | null }): AccessibleProject => ({
    id: p.id,
    name: p.name ?? "",
    created_at: p.created_at ?? null,
  });

  /** First non-empty (after trim) display name; safe for null/undefined/non-string DB values. */
  const preferredName = (raw: unknown): string | null => {
    if (raw == null) return null;
    const str = typeof raw === "string" ? raw : String(raw);
    return str.trim() ? str : null;
  };

  const mergeRows = (a: AccessibleProject, b: AccessibleProject): AccessibleProject => ({
    id: a.id,
    name: preferredName(a.name) ?? preferredName(b.name) ?? "",
    created_at: a.created_at ?? b.created_at,
  });

  const byId = new Map<string, AccessibleProject>();
  for (const p of ownedProjects ?? []) {
    byId.set(p.id, rowToAccessible(p));
  }
  for (const p of memberProjects) {
    const next = rowToAccessible(p);
    const prev = byId.get(p.id);
    byId.set(p.id, prev ? mergeRows(prev, next) : next);
  }
  for (const p of sharedProjects) {
    const next = rowToAccessible(p);
    const prev = byId.get(p.id);
    byId.set(p.id, prev ? mergeRows(prev, next) : next);
  }

  const merged = Array.from(byId.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  return { ok: true, projects: merged };
}
