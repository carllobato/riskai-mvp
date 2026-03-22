# RiskAI MVP — Page-by-Page Audit

**Purpose:** Describe what currently exists under each route and project, with no redesign or solutioning. Audit only.

---

## A. ROUTE MAP

### App entry and auth
| Route | Type | Notes |
|-------|------|--------|
| `/` | **Active** | Home: lists portfolios + projects; redirects to login if unauthenticated. Not under `(protected)` layout; auth done in page. |
| `/login` | **Active** | Login; post-auth uses `?next=` (default `/`). |
| `/create-project` | **Active** | Create new project; redirects to `/projects/[id]` on success. |
| `/project-not-found` | **Active** | Shown when project missing or access denied; clears `activeProjectId` from localStorage. |
| `/settings` | **Active** | User account settings (profile, email, user id, sign out). |

### Project-level (canonical MVP)
| Route | Type | Notes |
|-------|------|--------|
| `/projects` | **Active** | Project list (all user projects). |
| `/projects/[projectId]` | **Active** | Project Home / Dashboard. |
| `/projects/[projectId]/risks` | **Active** | Risk register (main project view). |
| `/projects/[projectId]/settings` | **Active** | Project settings (context, budget, schedule). |
| `/projects/[projectId]/simulation` | **Active** | Simulation: run and view cost/schedule results. |
| `/projects/[projectId]/run-data` | **Active** | Run Data: full diagnostic report for a simulation run. |
| `/projects/[projectId]/outputs` | **Placeholder/Redirect** | Client-side redirect to `/projects/[projectId]/run-data`. |

### Legacy project routes (redirect only)
| Route | Redirect target | Notes |
|-------|-----------------|--------|
| `/project` | `/projects/[activeId]` or `/` | Uses `RedirectToProjectRoute` + localStorage `activeProjectId`. |
| `/risk-register` | `/projects/[activeId]/risks` or `/` | Same pattern. |
| `/simulation` | `/projects/[activeId]/simulation` or `/` | Same pattern. |

### Standalone / ambiguous
| Route | Type | Notes |
|-------|------|--------|
| `/run-data` | **Active but ambiguous** | Same `RunDataPage` component; when `projectId` is undefined, does not load risks by project (relies on store from prior nav). Nav links to project-scoped run-data when a project is in URL. |
| `/outputs` | **Redirect** | Client-side redirect to `/run-data` (no project in URL). |

### Portfolio-level
| Route | Type | Notes |
|-------|------|--------|
| `/portfolios` | **Active** | Portfolio list (client component). |
| `/portfolios/[portfolioId]` | **Active** | Portfolio overview; uses **mock data** only (`MOCK_PORTFOLIO_SUMMARY`). |
| `/portfolios/[portfolioId]/projects` | **Active** | List of projects in portfolio; links to `/projects/[id]`. |
| `/portfolios/[portfolioId]/settings` | **Active** | Portfolio settings and members (admin only). |
| `/portfolios/[portfolioId]/admin` | **Legacy** | Documented in ROUTE_MAP as redirect to `.../settings`; no redirect file found under `app` (may be middleware or doc-only). |

### Retired / hidden from MVP nav
| Route | Type | Notes |
|-------|------|--------|
| `/analysis` | **Active** | Full analysis charts (Recharts); `hideInMvp` in NavBar when `uiMode === "MVP"`. |
| `/matrix` | **Active** | Risk matrix (P×C heat map); in MVP mode redirects to `/`. |
| `/day0` | **Active** | Day 0 risk extraction (paste text → API → risks); hidden from MVP nav. |
| `/dev/*` | **Dev** | Health, projects, user, supabase, mitigation, analysis; dev-only. |

### Error and catch-all
| Route | Type | Notes |
|-------|------|--------|
| `/404` | **Active** | 404 page. |
| `/[...notFound]` | **Active** | Catch-all not-found. |

---

## B. PAGE-BY-PAGE AUDIT

### 1. Home — `/`
- **Route:** `app/page.tsx` (root; not under `(protected)`).
- **Purpose:** Entry: show portfolios and projects the user can open.
- **Current contents:** Two sections — Portfolios (links to `/portfolios/[id]`) and Projects (links to `/projects/[id]`, Create first project / + New project).
- **Data loaded:** Server: `getAccessiblePortfolios`, Supabase `projects` (id, name, created_at). Redirects to `/login` if no user.
- **User actions:** Open portfolio, open project, create first project / new project.
- **Status:** **Working** — production-useful list and entry.

---

### 2. Project list — `/projects`
- **Route:** `app/(protected)/projects/page.tsx` → `ProjectListPageClient`.
- **Purpose:** List all projects the user has access to.
- **Current contents:** Title, description, list of project cards (name + “Open project”), “Create your first project” or “+ New project”.
- **Data loaded:** Client: `fetchProjectsClient()` (user’s projects).
- **User actions:** Open project, create project.
- **Status:** **Working**.

---

### 3. Project Home (Dashboard) — `/projects/[projectId]`
- **Route:** `app/(protected)/projects/[projectId]/page.tsx` → `ProjectOverviewContent`.
- **Purpose:** Project dashboard: health summary, forecast summary, key risk drivers, risk register snapshot.
- **Current contents:**
  - **A.** Project health: 6 tiles — Risks (count + high severity), Residual Risk Exposure, Residual Time Exposure, Contingency Held, Coverage Ratio, Last Simulation Run.
  - **B.** Forecast summary: Cost Forecast and Schedule Forecast cards (P10/P50/P80/P90 from latest snapshot, or “No simulation run yet. Run simulation on the Run Data page.”).
  - **C.** Key risk drivers: Top 5 Cost Risks, Top 5 Schedule Risks (or empty states).
  - **D.** Risk register snapshot: Open / High / Mitigated / Closed counts.
- **Data loaded:** Server: `getProjectIfAccessible`, project extra, risk count, latest `simulation_snapshots` row. Client: `listRisks(projectId)`, `loadProjectContext(projectId)` (localStorage), `computePortfolioExposure(risks)`.
- **User actions:** Read-only; no primary actions on this page (drill-down is via nav to Risks, Simulation, Run Data).
- **Status:** **Working** — coherent dashboard; copy references “Run Data page” for running simulation.

---

### 4. Risk Register — `/projects/[projectId]/risks`
- **Route:** `app/(protected)/projects/[projectId]/risks/page.tsx` → `RiskRegisterContent` (from `risk-register/RiskRegisterContent.tsx`).
- **Purpose:** Main risk register: table of risks, add/edit, save to server, AI review.
- **Current contents:** Header, risk table (sortable, filterable), “Add risk” (opens choice: file, AI, manual), risk detail modal, AI review drawer, save-to-server button, gate redirect when no project context in legacy mode.
- **Data loaded:** Client: `listRisks(projectIdForDb)` to hydrate store, `loadProjectContext` for gate. Uses `projectIdForDb = urlProjectId ?? DEFAULT_PROJECT_ID` when not in project URL.
- **User actions:** Add risk (file / AI / manual), open risk detail, edit, save to server, AI merge review, sort/filter table. Optional `?focusRiskId=` for scroll + highlight.
- **Status:** **Working** — production-useful. Legacy path uses `DEFAULT_PROJECT_ID` when no URL project.

---

### 5. Project Settings — `/projects/[projectId]/settings`
- **Route:** `app/(protected)/projects/[projectId]/settings/page.tsx` → `ProjectInformationPage` (from `project/ProjectInformationPage.tsx`).
- **Purpose:** Set project context used for simulation and interpretation (budget, schedule, risk appetite, etc.).
- **Current contents:** Form: project name, location, planned duration, target completion date, schedule contingency, risk appetite, currency, financial unit, project value, contingency value; validation; Excel upload section; “Continue to Risk Register” link.
- **Data loaded:** Client: `loadProjectContext(projectId)` (localStorage key can be project-specific). Optional server sync via POST `/api/project-context`.
- **User actions:** Edit form, save to localStorage (and optionally API), upload Excel, continue to Risk Register.
- **Status:** **Working**. Context is localStorage-first; project-scoped key when `projectId` is set.

---

### 6. Simulation — `/projects/[projectId]/simulation`
- **Route:** `app/(protected)/projects/[projectId]/simulation/page.tsx` → `SimulationPage` (from `simulation/SimulationPageContent.tsx`).
- **Purpose:** Run Monte Carlo simulation and view cost/schedule results for the project.
- **Current contents:**
  - If no snapshot for project: “No simulation run for this project yet” + “Run simulation” button + “Go to Run Data” link.
  - If snapshot exists: baseline row (base value, contingency, duration, target P-value), Cost Simulation and Schedule Simulation sections (with CDF/charts), “Last simulation run” footer.
  - Uses project context (e.g. risk appetite), latest snapshot from DB for this project.
- **Data loaded:** Client: `loadProjectContext`, risks from store, `getLatestSnapshot` / DB snapshot for project, `hydrateSimulationFromDbSnapshot` when project changes. Uses `effectiveProjectId = urlProjectId ?? activeProjectIdFromStorage ?? DEFAULT_PROJECT_ID` when not in URL.
- **User actions:** Run simulation (writes snapshot to DB), open “Go to Run Data” (`/projects/[id]/run-data`).
- **Status:** **Working**. Clear split: run vs view results; link to Run Data is explicit.

---

### 7. Run Data — `/projects/[projectId]/run-data`
- **Route:** `app/(protected)/projects/[projectId]/run-data/page.tsx` (server) → `RunDataPage` (from `run-data/page.tsx`) with `projectId` and `projectName` passed.
- **Purpose:** Full diagnostic report for a simulation run (inputs, distribution, integrity, assumptions, consistency, drivers, exposure, forecasting, mitigation).
- **Current contents:** Long single page with narrative sections: Run Metadata, Risk Register Snapshot, Cost/Schedule Distribution, Simulation Integrity (sample size, skew, kurtosis), Simulation Assumptions, Consistency Checks, Cost/Schedule Drivers, Scenario Exposure, Forward-looking, Mitigation Results / Leverage. “Run Data” title; when under project route, project context is clear.
- **Data loaded:** Client: `listRisks(projectId)` when `projectId` present, store `simulation` and risks, `getLatestSnapshot` / `getLatestDbSnapshot`, scenario comparison, exposure, etc.
- **User actions:** Read and validate run; no primary “run” here (run is on Simulation page).
- **Status:** **Working** — production-useful diagnostic/report. Project-scoped when accessed via `/projects/[id]/run-data`.

---

### 8. Outputs (project) — `/projects/[projectId]/outputs`
- **Route:** `app/(protected)/projects/[projectId]/outputs/page.tsx`.
- **Purpose:** Legacy name; redirect only.
- **Current contents:** `router.replace(projectId ? `/projects/${projectId}/run-data` : "/run-data")`.
- **Status:** **Redirect only** — no content; removes ambiguity by sending to Run Data.

---

### 9. Run Data (standalone) — `/run-data`
- **Route:** `app/(protected)/run-data/page.tsx` (default export is the same `RunDataPage` component).
- **Purpose:** Same Run Data UI without project in URL.
- **Current contents:** Identical to Run Data under a project, but `projectId` and `projectName` are undefined. Risks are not loaded by project (effect only when `projectId` is set); page uses whatever is in the risk register store.
- **Data loaded:** Store state only when `projectId` is missing; no `listRisks` call.
- **User actions:** Same as project Run Data; context is ambiguous when opened without a project.
- **Status:** **Partial / ambiguous** — works if user arrived from a project context; otherwise can show stale or empty data. Nav (NavBar) points to project-scoped Run Data when there is a project in the path; “Run Data” is marked TEMP for dev audit in NavBar.

---

### 10. Outputs (root) — `/outputs`
- **Route:** `app/(protected)/outputs/page.tsx`.
- **Purpose:** Legacy; redirect to Run Data.
- **Current contents:** `router.replace("/run-data")`.
- **Status:** **Redirect only** — sends to standalone `/run-data`.

---

### 11. Create project — `/create-project`
- **Route:** `app/(protected)/create-project/page.tsx`.
- **Purpose:** Create a new project (name only).
- **Current contents:** Form (project name), submit, “Back to projects”.
- **Data loaded:** Client: auth; insert into Supabase `projects` with `owner_user_id`, `name`.
- **User actions:** Enter name, create, then redirect to `/projects/[id]` and set `activeProjectId` in localStorage.
- **Status:** **Working**.

---

### 12. Project not found — `/project-not-found`
- **Route:** `app/(protected)/project-not-found/page.tsx`.
- **Purpose:** Shown when project is missing or access denied (from project layout).
- **Current contents:** Message, “Go to projects”, “Create project”.
- **User actions:** Navigate away or create project.
- **Status:** **Working**.

---

### 13. User settings — `/settings`
- **Route:** `app/(protected)/settings/page.tsx`.
- **Purpose:** Account profile and sign out.
- **Current contents:** Profile form (first/last name, company), email, user ID, sign out, “Back to portfolios”.
- **Data loaded:** Server: `getUser()`.
- **Status:** **Working**.

---

### 14. Portfolios list — `/portfolios`
- **Route:** `app/(protected)/portfolios/page.tsx` → `PortfoliosPageClient`.
- **Purpose:** List portfolios the user can access.
- **Current contents:** Client fetches and renders portfolio list (implementation in PortfoliosPageClient).
- **Status:** **Active** (client implementation not fully inspected here).

---

### 15. Portfolio overview — `/portfolios/[portfolioId]`
- **Route:** `app/(protected)/portfolios/[portfolioId]/page.tsx` → `PortfolioOverviewContent`.
- **Purpose:** Executive snapshot of portfolio risk.
- **Current contents:** KPI summary (projects, active risks, contingency, exposure, coverage), Top 5 Cost Risks, Top 5 Schedule Risks (or similar). All from **mock data** (`MOCK_PORTFOLIO_SUMMARY`).
- **Data loaded:** Mock only; docstring says “wire to live data later”.
- **Status:** **Partial** — UI in place, data not live.

---

### 16. Portfolio projects — `/portfolios/[portfolioId]/projects`
- **Route:** `app/(protected)/portfolios/[portfolioId]/projects/page.tsx`.
- **Purpose:** List projects in the portfolio.
- **Current contents:** Server fetches portfolio + projects; list of links to `/projects/[id]`.
- **Status:** **Working**.

---

### 17. Portfolio settings — `/portfolios/[portfolioId]/settings`
- **Route:** `app/(protected)/portfolios/[portfolioId]/settings/page.tsx` → `PortfolioSettingsContent`.
- **Purpose:** Portfolio name, description, members; admin only.
- **Data loaded:** Server: `assertPortfolioAdminAccess`, portfolio, `portfolio_members`.
- **Status:** **Working** (admin access enforced).

---

### 18. Legacy redirects — `/project`, `/risk-register`, `/simulation`
- **Route:** Each has a page that renders `RedirectToProjectRoute` with slug `project-home`, `risks`, or `simulation`.
- **Behaviour:** Read `activeProjectId` from localStorage; redirect to `/projects/[activeId]` or `/projects/[activeId]/[slug]`, else `/`.
- **Status:** **Working as intended** — legacy entry points.

---

### 19. Analysis — `/analysis`
- **Route:** `app/(protected)/analysis/page.tsx`.
- **Purpose:** Charts and analysis (Recharts, selectors, project context).
- **Status:** **Active** but **hidden in MVP** nav (`hideInMvp`). Full-featured; not part of MVP nav.

---

### 20. Matrix — `/matrix`
- **Route:** `app/(protected)/matrix/page.tsx`.
- **Purpose:** Risk matrix (P×C heat map).
- **Behaviour:** In MVP mode redirects to `/`.
- **Status:** **Active** but **MVP redirect**; hidden from MVP nav.

---

### 21. Day 0 — `/day0`
- **Route:** `app/(protected)/day0/page.tsx`.
- **Purpose:** Paste document text → POST `/api/extract-risks` → display extracted risks.
- **Status:** **Active** but **hidden from MVP nav**; simple extraction UI.

---

### 22. Dev routes — `/dev/*`
- **Routes:** health, projects, user, supabase, mitigation, analysis.
- **Status:** **Dev-only**; not part of MVP.

---

## C. DUPLICATION / CONFUSION RISKS

1. **Run Data in two places**
   - **Project-scoped:** `/projects/[projectId]/run-data` — correct context, loads risks for project.
   - **Standalone:** `/run-data` — same component, no projectId; does not load risks; relies on store. Risk of showing wrong or empty data if user lands here without having been in a project. Nav already prefers project-scoped link when URL has a project; “Run Data” is still in nav with a TEMP note for dev audit.

2. **Outputs vs Run Data**
   - `/outputs` and `/projects/[id]/outputs` only redirect to Run Data. Name “outputs” is retired; no duplication of content, only two redirect entry points.

3. **Project Home vs Project Settings**
   - Clear: Home = dashboard (read-only summary); Settings = form and context. No overlap.

4. **Simulation vs Run Data**
   - Simulation = run + compact results + “Go to Run Data”. Run Data = full diagnostic report. Clear split; Simulation links to Run Data. No duplication of “run” action.

5. **Legacy routes**
   - `/project`, `/risk-register`, `/simulation` redirect using localStorage; if no active project, user goes to `/`. Slight confusion if someone bookmarks a legacy URL and has no active project.

6. **Portfolio overview mock data**
   - `/portfolios/[portfolioId]` uses mock data only; “Portfolio Overview” in sidebar can look production-ready but is not wired to real data.

7. **Nav: Run Data**
   - NavBar comment: “TEMP: Run Data nav item for development audit – remove before production.” So Run Data is explicitly marked for product decision (keep vs remove vs only project-scoped).

8. **RedirectToProjectRoute**
   - Supports only `project-home` | `risks` | `simulation`. There is no legacy `/run-data` redirect to project-scoped run-data; `/run-data` is a real page.

---

## D. RECOMMENDED PAGE-BY-PAGE REVIEW ORDER

Suggested order for deciding what stays, what changes, and what gets removed:

1. **Project Home** (`/projects/[projectId]`) — Central dashboard; confirm metrics, copy (“Run Data page”), and links.
2. **Risk Register** (`/projects/[projectId]/risks`) — Core workflow; confirm save, AI, and project context behaviour (including legacy `DEFAULT_PROJECT_ID`).
3. **Project Settings** (`/projects/[projectId]/settings`) — Context and localStorage vs server; confirm “Continue to Risk Register” and any API sync.
4. **Simulation** (`/projects/[projectId]/simulation`) — Run vs view; confirm “Go to Run Data” and that run is the single place to trigger simulation.
5. **Run Data (project-scoped)** (`/projects/[projectId]/run-data`) — Decide scope of diagnostic content and whether all sections stay; confirm it’s the only “full report” view for a run.
6. **Run Data (standalone)** (`/run-data`) — Decide: remove, redirect to project list, or only allow when coming from a project (e.g. redirect if no project in URL).
7. **Outputs redirects** (`/outputs`, `/projects/[id]/outputs`) — Confirm permanent redirect to Run Data and that no links still say “Outputs”.
8. **Create project & Project not found** — Quick check: flows and messaging.
9. **Home & Project list** (`/`, `/projects`) — Entry and list; confirm no duplicate “project list” surfaces.
10. **Portfolio overview** (`/portfolios/[portfolioId]`) — Decide when to replace mock data and whether to keep or simplify until then.
11. **Legacy routes** (`/project`, `/risk-register`, `/simulation`) — Confirm redirect behaviour and whether to keep or retire.
12. **Analysis, Matrix, Day 0** — Decide MVP visibility and whether they stay behind a flag or separate entry.

This order focuses on project-scoped flows first (dashboard → risks → settings → simulation → run data), then Run Data standalone and redirects, then entry/portfolio and legacy/MVP boundaries.
