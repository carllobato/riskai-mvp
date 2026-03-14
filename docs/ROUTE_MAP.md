# RiskAI MVP Route Map (Day 11)

## Current vs intended MVP routes

### Canonical MVP routes (use these in nav and links)

| Path | Purpose | Keep/Redirect/Retire |
|------|---------|----------------------|
| `/` | App home; redirects to `/projects/[id]/risks` or `/create-project` | **Keep** |
| `/create-project` | Create first/new project | **Keep** |
| `/project-not-found` | Shown when project missing or access denied | **Keep** |
| `/projects/[projectId]` | Project Home Dashboard | **Keep** |
| `/projects/[projectId]/risks` | Risk register (main project view) | **Keep** |
| `/projects/[projectId]/settings` | Project settings (context, budget, schedule) | **Keep** |
| `/projects/[projectId]/simulation` | Simulation (run/view results) | **Keep** |
| `/projects/[projectId]/outputs` | Outputs (mitigation, exposure); not in MVP nav | **Keep** (retired from nav) |
| `/portfolios/[portfolioId]/settings` | Portfolio settings and members | **Keep** |
| `/settings` | User account settings (email, id, sign out) | **Keep** |

### Legacy routes (redirect only)

| Path | Redirect target | Notes |
|------|-----------------|--------|
| `/portfolios/[portfolioId]/admin` | `/portfolios/[portfolioId]/settings` | Permanent redirect |
| `/projects/[projectId]/setup` | `/projects/[projectId]/settings` | Permanent redirect |
| `/project` | `/projects/[activeId]` (dashboard) or `/` | Redirect only |
| `/risk-register` | `/projects/[activeId]/risks` or `/` | Redirect only; content at `risks` |
| `/simulation` | `/projects/[activeId]/simulation` or `/` | Redirect only; content at `simulation` |

### Retired from MVP navigation (still exist as routes)

- `/outputs` – not in primary nav (`hideInMvp`); project-scoped at `/projects/[id]/outputs`
- `/analysis` – not in primary nav
- `/matrix` – not in primary nav; MVP redirects to `/`
- `/day0` – not in primary nav
- `/dev/*` – dev-only

### Auth and entry

- `/login` – login; post-auth redirect uses `?next=` (default `/`)
- Protected layout: unauthenticated users redirect to `/login?next=<pathname>` (default pathname `/`)

## Portfolio routes

- `/portfolios` – portfolio list
- `/portfolios/[portfolioId]` – portfolio detail (redirects to projects)
- `/portfolios/[portfolioId]/settings` – portfolio settings and members (owner or portfolio admin)
- `/portfolios/[portfolioId]/admin` – redirects to `/portfolios/[portfolioId]/settings`

## Navigation (MVP)

- **RiskAI (logo)** → `/` or `/projects/[id]/risks`
- **Settings** (project) → `/projects/[id]/settings` (or `/` when no project)
- **Settings** (user) → `/settings` (account; add to nav if desired)
- **Risk Register** → `/projects/[id]/risks` (or `/` when no project)
- **Simulation** → `/projects/[id]/simulation` (or `/` when no project)
- Outputs, Analysis, Matrix, Day 0, Engine Health → hidden when `uiMode === "MVP"`

## Internal links updated (Day 11)

- Project settings “Continue to Risk Register” → project-scoped `/projects/[id]/risks` or `/`
- SimulationSection “Target P-Value” (debug) → `settingsHref` (e.g. `/projects/[id]/settings`) or `/`
- Login default `next` → `/`
- Protected layout default pathname → `/`
- Supabase proxy post-login redirect → `/`
- Matrix (MVP) redirect → `/` (was `/outputs`)
- Risk register / simulation legacy `setupRedirectPath` → `/` when no project
