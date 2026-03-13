# RiskAI MVP Route Map (Day 11)

## Current vs intended MVP routes

### Canonical MVP routes (use these in nav and links)

| Path | Purpose | Keep/Redirect/Retire |
|------|---------|----------------------|
| `/` | App home; redirects to `/projects/[id]/risks` or `/create-project` | **Keep** |
| `/create-project` | Create first/new project | **Keep** |
| `/project-not-found` | Shown when project missing or access denied | **Keep** |
| `/projects/[projectId]/risks` | Risk register (main project view) | **Keep** |
| `/projects/[projectId]/setup` | Project settings (context, budget, schedule) | **Keep** |
| `/projects/[projectId]/simulation` | Simulation (run/view results) | **Keep** |
| `/projects/[projectId]/outputs` | Outputs (mitigation, exposure); not in MVP nav | **Keep** (retired from nav) |
| `/projects/[projectId]/admin` | Not implemented; use `setup` for project admin/settings | **Placeholder** (use `setup`) |

### Legacy routes (redirect only)

| Path | Redirect target | Notes |
|------|-----------------|--------|
| `/project` | `/projects/[activeId]/setup` or `/` | Redirect only; content at `setup` |
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

## Portfolio routes (future)

Target shape for later:

- `/portfolios` – portfolio list
- `/portfolios/[portfolioId]` – portfolio detail
- `/portfolios/[portfolioId]/admin` – portfolio admin

Not implemented in this cleanup; app remains project-centric.

## Navigation (MVP)

- **RiskAI (logo)** → `/` or `/projects/[id]/risks`
- **Settings** → `/projects/[id]/setup` (or `/` when no project)
- **Risk Register** → `/projects/[id]/risks` (or `/` when no project)
- **Simulation** → `/projects/[id]/simulation` (or `/` when no project)
- Outputs, Analysis, Matrix, Day 0, Engine Health → hidden when `uiMode === "MVP"`

## Internal links updated (Day 11)

- Project settings “Continue to Risk Register” → project-scoped `/projects/[id]/risks` or `/`
- SimulationSection “Target P-Value” (debug) → `settingsHref` (e.g. `/projects/[id]/setup`) or `/`
- Login default `next` → `/`
- Protected layout default pathname → `/`
- Supabase proxy post-login redirect → `/`
- Matrix (MVP) redirect → `/` (was `/outputs`)
- Risk register / simulation legacy `setupRedirectPath` → `/` when no project
