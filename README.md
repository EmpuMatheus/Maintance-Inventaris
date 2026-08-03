<div align="center">

# Office Inventory Management System

**Enterprise Asset Management, Maintenance Tracking, Ticketing & Reporting**

A production-ready asset & maintenance management platform for IT teams — inventory control, QR-based asset lookup, preventive & corrective maintenance workflows, ticketing, notifications, analytics, role-based access and audit logging — delivered as a web app with desktop launchers for both end users and developers.

[![Version](https://img.shields.io/badge/version-1.0.0-6366f1)](https://github.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D14-4169e1)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/react-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5-3178c6)](https://www.typescriptlang.org/)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Production Installation](#production-installation)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Running the Application](#running-the-application)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [API](#api)
- [Documentation](#documentation)
- [Permissions](#permissions)
- [Testing](#testing)
- [Deployment](#deployment)
- [Backup](#backup)
- [Release](#release)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## Overview

The Office Inventory Management System is built to help IT teams **manage, monitor and maintain** every office asset. It is more than an asset database — it is a **central monitoring hub** that records and correlates the full lifecycle of each asset:

- Identity, specifications, purchase & warranty details
- Location (site → building → floor → room), department and PIC (person in charge)
- Current condition and full condition-change history
- Assignment and movement history
- Preventive and corrective maintenance history
- QR-based identification and lookup
- Incident tickets
- Documents and photos
- Automated analytics (health scores, repeated-failure detection, replacement recommendations)
- Full audit trail of who did what, when

**Business goals:**

- **Visibility** — a single source of truth for every asset's location, condition, custodian and history.
- **Reliability** — preventive-maintenance scheduling reduces unplanned downtime and extends asset life.
- **Accountability** — role-based access, assignments and audit logs make every action traceable.
- **Efficiency** — tickets, notifications and a real-time dashboard let technicians act fast.
- **Decision support** — health scores, failure analytics, MTBF/MTTR and replacement recommendations inform budget decisions.

---

## Features

| Area | Description |
|------|-------------|
| **Inventory** | Full asset registry with categories, subcategories, brands, vendors, sites and locations; search, filter, sort and pagination. |
| **Asset Management** | Create, update, retire and dispose assets; manage serial numbers, purchase and warranty data, photos and documents. |
| **QR Code** | Every asset gets a scannable QR code; camera scan or manual lookup returns the asset instantly. |
| **Assignment** | Assign assets to users/departments, return and transfer between locations with full movement history. |
| **Condition Monitoring** | Condition lifecycle (GOOD → FAIR → NEED_ATTENTION → BROKEN → CRITICAL → RETIRED) with reason-coded history. |
| **Preventive Maintenance** | Recurring schedules, automatic generation of due maintenance, reminders and a calendar view. |
| **Corrective Maintenance** | Full workflow: create → assign → start → waiting parts → testing → complete/cancel, with parts, documents and cost tracking. |
| **Maintenance Calendar** | Monthly calendar of due and upcoming maintenance with timezone-safe dates. |
| **Ticket System** | Report, assign, comment and resolve tickets with status workflow and priority. |
| **Notification Center** | In-app notifications with a bell indicator, unread counts and real-time polling. |
| **Dashboard** | Asset, maintenance, ticket and schedule summaries; condition and cost analytics; recent activity. |
| **Reports** | Inventory, maintenance, maintenance cost, asset condition, broken asset, movement, warranty and asset-aging reports with XLSX export. |
| **Audit Logs** | Automated, searchable audit trail of every privileged action across modules. |
| **Role-Based Access Control** | Granular permissions (inventory, maintenance, tickets, reports, analytics, administration, backup) per role. |
| **Advanced Analytics** | Asset health scores, repeated-failure detection, replacement recommendations, MTBF/MTTR and trend charts. |
| **Production-Ready Launchers** | `Office Inventory.exe` for end users and `OfficeInventoryDev.exe` for developers — no terminal required. |

---

## Screenshots

> Screenshots coming soon.

| | |
|---|---|
| **Dashboard** — `![Dashboard](docs/screenshots/dashboard.png)` | **Inventory** — `![Inventory](docs/screenshots/inventory.png)` |
| **Maintenance** — `![Maintenance](docs/screenshots/maintenance.png)` | **Reports** — `![Reports](docs/screenshots/reports.png)` |
| **Notifications** — `![Notifications](docs/screenshots/notifications.png)` | |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 6, Tailwind CSS 3, React Router 7 |
| **State Management** | TanStack Query (server state), React Hook Form + Zod (forms) |
| **UI** | Custom Tailwind design system, lucide-react icons |
| **Charts** | Recharts |
| **Backend** | Node.js (≥ 20), Express 5, TypeScript 5 |
| **Database** | PostgreSQL ≥ 14 with Drizzle ORM + drizzle-kit migrations |
| **Authentication** | JWT (access token), argon2id password hashing, role-scoped permissions |
| **QR** | html5-qrcode (scan) + qrcode (generate) |
| **Excel Export** | ExcelJS |
| **Testing** | Vitest (integration + unit), ESLint, tsc typecheck |
| **Deployment** | Production API bundle (esbuild), static SPA, Node SEA desktop launchers, Inno Setup installer |

---

## Project Structure

```text
.
├── apps/
│   ├── api/                     # REST API (Express + Drizzle)
│   │   ├── src/
│   │   │   ├── config/          # env, cors, https, version, analytics config
│   │   │   ├── database/        # schema, migrations (SQL), seeds
│   │   │   ├── lib/             # logger, rotating logs, backup, password, jwt, upload, scheduler
│   │   │   ├── middleware/      # authenticate, authorize, validate, rate-limit, error handling
│   │   │   └── modules/         # auth, assets, maintenance, tickets, reports, analytics, audit, users, roles, backup, health, …
│   │   └── tests/               # Vitest integration/unit tests
│   └── web/                     # React SPA (Vite)
│       └── src/
│           ├── app/             # router, providers
│           ├── components/      # ui + layout
│           ├── features/        # feature modules (inventory, maintenance, reports, analytics, …)
│           └── lib/             # api client, auth, build info
├── packages/
│   └── shared/                  # shared types/constants
├── tools/
│   ├── launcher/                # production SEA launcher source
│   └── dev-launcher/            # developer SEA launcher source
├── scripts/                     # build / release / installer automation
├── installer/                   # Inno Setup installer script + icon
├── certs/                       # development TLS certificates
├── docs/                        # project documentation
└── storage/                     # uploads, logs, backups (runtime data)
```

**Major folders explained:**

- **`apps/api`** — the backend. Express routes call controllers → services (business logic) → repositories (data access via Drizzle). Migrations live in `apps/api/src/database/migrations`; the seed script populates roles, permissions and the default admin.
- **`apps/web`** — the frontend SPA. Feature folders each contain `pages`, `components`, `api` and `hooks`. Server data is fetched with TanStack Query; route pages are lazy-loaded.
- **`packages/shared`** — types and constants shared between frontend and backend.
- **`tools/`** — the sources for the two desktop launchers (production and developer), bundled into Node SEA executables.
- **`scripts/`** — production build, SEA packaging, release assembly and installer automation (`.mjs`).
- **`docs/`** — PRD, database, API, UI/UX, task tracking, deployment, backup, restore, environment and analytics documentation.

---

## Installation

### Requirements

- **Node.js ≥ 20** (tested on 22)
- **PostgreSQL ≥ 14** with `pg_dump` available for database backups
- npm ≥ 9

### Developer Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd Maintance-Inventaris

# 2. Install dependencies
npm install

# 3. Configure the environment
cp .env.example .env
# edit .env — set DATABASE_URL and other values (see docs/ENVIRONMENT.md)

# 4. Create and populate the database
npm run db:migrate
npm run db:seed          # creates roles, permissions and the default admin (admin/admin123)

# 5. Run backend
npm run dev:api          # API at http://localhost:3000  (or: npm run dev to run both)

# 6. Run frontend (separate terminal)
npm run dev:web          # Vite dev server at https://localhost:5173
```

Or start both at once with:

```bash
npm run dev
```

> The Vite dev server uses HTTPS with the certificates in `certs/` and proxies `/api` to the backend, so the app works on `localhost` and LAN IPs without CORS changes.

---

## Production Installation

### Launcher (end users)

End users double-click **Office Inventory.exe** — no terminal, npm commands or manual backend startup required.

```bash
npm run package:release   # builds React + production backend bundle + SEA launcher into release/
```

The launcher starts the backend, serves the SPA, opens the browser, restarts the backend if it crashes, keeps rotating logs and prevents duplicate instances. See **[docs/LAUNCHER.md](docs/LAUNCHER.md)**.

### Developer launcher

```bash
npm run build:dev-launcher   # produces OfficeInventoryDev.exe at the repo root
```

Detects Node/npm/PostgreSQL, validates `.env`, installs dependencies if missing, runs both dev servers, opens a control panel with live status, streaming logs and restart/stop buttons.

### Production build

```bash
npm run build:prod        # shared + web + api with NODE_ENV=production
npm run check:prod        # validate release artifacts before shipping
npm run start:prod        # run the API from the production bundle
```

### Installer

```bash
npm run build:installer   # requires Inno Setup 6 (ISCC.exe) — see installer/installer.iss
```

Creates an installer with desktop + Start Menu shortcuts, uninstall registration and an optional Startup shortcut.

### Server deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for Windows and Linux deployments, reverse proxy (Nginx / Apache / IIS) examples and HTTPS configuration.

---

## Environment Variables

Configuration is read from `.env` (see `.env.example`). **`DATABASE_URL` is required**; every other variable has a sensible default. In `APP_ENV=production` the server **fails fast** unless `JWT_SECRET` (≥ 32 chars) and `CORS_ORIGIN` are set explicitly.

### Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | derived from `NODE_ENV` | `development` \| `production` \| `test` |
| `NODE_ENV` | `development` | Legacy alias; `APP_ENV` wins if both are set |
| `PORT` | `3000` | HTTP port for the API |
| `API_PREFIX` | `/api/v1` | API path prefix |
| `BASE_URL` | *(empty)* | Public base URL of the deployment |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowlist (only source of truth in production) |
| `REQUEST_BODY_LIMIT` | `2mb` | JSON body size limit |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | *(required)* | `postgresql://user:pass@host:5432/db` |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | dev default | **Must be a random secret ≥ 32 chars in production** |
| `JWT_EXPIRES_IN` | `15m` | Access-token lifetime |

### HTTPS & Proxy

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTPS_ENABLED` | `false` | Serve TLS directly |
| `HTTPS_KEY` / `HTTPS_CERT` | dev certs | Paths to the TLS key/certificate |
| `COOKIE_SECURE` | derived | Mark cookies Secure when HTTPS is on |
| `TRUST_PROXY` | `false` | Express `trust proxy`: `false`, `true`, hop count, or `loopback` |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `debug` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_DIR` | `logs` | Production rotating-log directory (relative to the storage root) |
| `LOG_RETENTION_DAYS` | `30` | Delete logs older than N days |

### Backups

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `backups` | Backup root (relative to the storage root) |
| `BACKUP_DATABASE_RETENTION_DAYS` | `14` | Database backup retention |
| `BACKUP_UPLOADS_RETENTION_DAYS` | `14` | Upload backup retention |
| `BACKUP_INTERVAL_MINUTES` | `0` | Scheduled database backup interval (`0` disables; production only) |
| `PG_DUMP_PATH` | `pg_dump` | Absolute path to `pg_dump` if not on `PATH` |

### Production admin (seed)

| Variable | Default | Description |
|----------|---------|-------------|
| `PROD_ADMIN_USERNAME` | `admin` | Admin created by `npm run db:seed:prod` |
| `PROD_ADMIN_PASSWORD` | *(empty)* | Strong initial password (forced change on first login) |
| `PROD_ADMIN_NAME` | `Production Administrator` | Display name |

### Analytics (health score & recommendations)

| Variable | Default | Description |
|----------|---------|-------------|
| `ANALYTICS_RECALC_INTERVAL_MINUTES` | `1440` | How often the background job recomputes health scores |
| `ANALYTICS_WEIGHT_AGE` | `20` | Health-score weight: asset age |
| `ANALYTICS_WEIGHT_MAINTENANCE` | `20` | Health-score weight: maintenance frequency |
| `ANALYTICS_WEIGHT_FAILURE_RATIO` | `15` | Health-score weight: failure ratio |
| `ANALYTICS_WEIGHT_CONDITION` | `20` | Health-score weight: current condition |
| `ANALYTICS_WEIGHT_DOWNTIME` | `10` | Health-score weight: downtime |
| `ANALYTICS_WEIGHT_TICKETS` | `10` | Health-score weight: ticket frequency |
| `ANALYTICS_WEIGHT_CRITICAL_EVENTS` | `5` | Health-score weight: critical condition events |
| `ANALYTICS_EXPECTED_LIFESPAN_YEARS` | `7` | Expected asset lifespan |
| `ANALYTICS_FAILURE_THRESHOLD` | `3` | Corrective repairs before repeated-failure flag |
| `ANALYTICS_TICKET_THRESHOLD` | `3` | Tickets before repeated-failure flag |
| `ANALYTICS_FAILURE_WINDOW_DAYS` | `90` | Detection window |
| `ANALYTICS_REPLACE_IMMEDIATE_HEALTH` | `35` | Health threshold for Replace Immediately |
| `ANALYTICS_REPLACE_SOON_HEALTH` | `50` | Health threshold for Replace Soon |
| `ANALYTICS_REPAIR_HEALTH` | `65` | Health threshold for Repair |
| `ANALYTICS_REPLACE_COST_RATIO` | `0.5` | Maintenance cost / purchase price ratio |

### Misc

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_VERSION` | `1.0.0` | Version reported by `/metrics` |
| `APP_BUILD_TIME` | *(empty)* | Build timestamp reported by `/metrics` |
| `SERVE_SPA_DIR` | *(empty)* | Serve a built React SPA from the same origin (desktop launcher) |
| `STORAGE_ROOT` | derived | Override the storage root (uploads/logs/backups) |
| `SCHEDULE_PROCESS_INTERVAL_MINUTES` | `60` | Preventive-maintenance background processor interval |

### Frontend (`VITE_*` — public, bundled into the browser)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_APP_NAME` | Office Inventory Management System | App display name |
| `VITE_APP_VERSION` | `1.0.0` | Version shown in the UI |
| `VITE_API_URL` | `/api/v1` | API base URL; set an absolute URL in production |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Vite dev proxy target (development only) |

> The complete reference with every variable and production examples is in **[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)** and `.env.example`.

---

## Database

PostgreSQL ≥ 14. Schema, tables and indexes are defined with Drizzle ORM in `apps/api/src/database/schema` and applied as SQL migrations.

```bash
# Generate a migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Open the Drizzle Studio UI
npm run db:studio

# Seed roles, permissions and the default admin
npm run db:seed            # development admin (admin/admin123)

# Seed the production admin (forced password change on first login)
npm run db:seed:prod
```

See **[docs/DATABASE.md.txt](docs/DATABASE.md.txt)** for the full schema documentation.

---

## Running the Application

### Developer mode

```bash
npm run dev          # backend (tsx watch) + frontend (Vite) together
# or in two terminals:
npm run dev:api      # API at http://localhost:3000
npm run dev:web      # SPA at https://localhost:5173
```

### Production mode

```bash
npm run build:prod
npm run start:prod   # serves the API bundle
# serve apps/web/dist with any static server / reverse proxy
```

### Launcher mode

- **End users:** double-click `release/Office Inventory.exe`.
- **Developers:** double-click `OfficeInventoryDev.exe` (build with `npm run build:dev-launcher`).

---

## Scripts

### Root (`package.json`)

| Script | Description |
|--------|-------------|
| `dev` | Run backend and frontend dev servers together |
| `dev:api` | Run the API dev server (`tsx watch`) |
| `dev:web` | Run the Vite dev server |
| `build` | Build shared, web and api (development) |
| `build:prod` | Production build (shared + web + api, writes `build-info.json`) |
| `start:prod` | Run the API from the production bundle |
| `check:prod` | Validate release artifacts before shipping |
| `build:launcher` | Build the production SEA launcher (`release/Office Inventory.exe`) |
| `build:dev-launcher` | Build the developer SEA launcher (`OfficeInventoryDev.exe`) |
| `package:release` | Assemble the full `release/` folder (build + launcher + runtime deps) |
| `build:installer` | Build the Inno Setup installer (requires Inno Setup 6) |
| `generate:icon` | Regenerate `installer/office-inventory.ico` |
| `lint` | ESLint over all TS/TSX files |
| `typecheck` | `tsc --noEmit` for shared, web and api |
| `test` | Run all automated tests |
| `format` | Prettier format all source files |
| `db:generate` | Generate a Drizzle migration from schema changes |
| `db:migrate` | Apply pending migrations |
| `db:studio` | Open Drizzle Studio |
| `db:seed` | Seed roles, permissions and the development admin |
| `db:seed:prod` | Seed the production admin (`APP_ENV=production`) |

### Workspaces

| Script | Where | Description |
|--------|-------|-------------|
| `dev` | `apps/api` | API dev server (`tsx watch src/server.ts`) |
| `build` | `apps/api` | Typecheck + bundle the API (`tsc --noEmit && node scripts/build.mjs`) |
| `start` | `apps/api` | Run the bundled API (`node dist/server.cjs`) |
| `test` | `apps/api` | Vitest run |
| `dev` / `build` / `preview` | `apps/web` | Vite dev / production build / preview |

---

## Architecture

### Frontend

React SPA organized by feature. Pages are lazy-loaded and route-level code-split. Server state is managed with **TanStack Query** (cached, re-fetched with invalidation); forms use React Hook Form with Zod validation. The API client attaches the JWT and surfaces 401/session expiry globally.

### Backend

Express layered architecture, per module:

```text
routes (HTTP) → controllers → services (business logic) → repositories (Drizzle data access)
```

- **Controllers** handle request/response and validation errors.
- **Services** implement business rules (e.g., the maintenance state machine, health-score algorithm, ticket workflow).
- **Repositories** contain all SQL via Drizzle; queries are parameterized and paginated.

### Repository & Service layers

Repositories never expose raw SQL to callers and always use parameterized queries. Services compose repositories and implement the domain rules, keeping controllers thin.

### Authentication

JWT bearer tokens (expiring access token). Passwords are hashed with **argon2id**. The `authenticate` middleware verifies the token; the `authorize('permission')` middleware enforces role permissions. Login is rate-limited to mitigate brute force.

### Analytics

A background scheduler recomputes deterministic **asset health scores**, detects **repeated failures** and produces **replacement recommendations** (see **[docs/ANALYTICS.md](docs/ANALYTICS.md)**).

---

## API

The API is documented in **[docs/API.md.txt](docs/API.md.txt)**.

- Base path: `/api/v1`
- Authentication: `Authorization: Bearer <token>`
- Health endpoints: `GET /health`, `/health/live`, `/health/ready`, `/metrics`
- Response shape: `{ "success": true, "data": ... }` and `{ "success": false, "error": { "code", "message" } }`

---

## Documentation

| Document | Path |
|----------|------|
| Product Requirements Document | [docs/PRD.md.txt](docs/PRD.md.txt) |
| Database Design | [docs/DATABASE.md.txt](docs/DATABASE.md.txt) |
| API Reference | [docs/API.md.txt](docs/API.md.txt) |
| UI / UX Design | [docs/UI_UX.md.txt](docs/UI_UX.md.txt) |
| Task Tracking | [docs/TASK.md.txt](docs/TASK.md.txt) |
| Deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Backup | [docs/BACKUP.md](docs/BACKUP.md) |
| Restore | [docs/RESTORE.md](docs/RESTORE.md) |
| Environment Variables | [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) |
| Desktop Launchers | [docs/LAUNCHER.md](docs/LAUNCHER.md) |
| Analytics Algorithms | [docs/ANALYTICS.md](docs/ANALYTICS.md) |
| Release Checklist | [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) |
| Coding Standards | [docs/CODING_STANDARS.md.txt](docs/CODING_STANDARS.md.txt) |

---

## Permissions

Access is controlled by **role-based access control (RBAC)**. Each role maps to a set of granular permissions; the frontend hides unavailable menus/actions and the API enforces each permission on the server.

**Built-in roles:**

| Role | Scope |
|------|-------|
| `SUPER_ADMIN` | All permissions |
| `IT_ADMIN` | Full operational management (assets, maintenance, tickets, reports, users, roles, analytics) |
| `TECHNICIAN` | Asset/monitoring read + maintenance and ticket operations |
| `VIEWER` | Read-only access across modules + analytics |

**Permission families:** `asset.*`, `maintenance.*`, `ticket.*`, `master_data.*`, `report.*`, `user.*`, `role.*`, `audit.read`, `notification.read`, `analytics.read`, `backup.manage`, `settings.manage`.

Roles and permissions are managed under **Administration → Roles** (permission matrix) and **Administration → Users**.

---

## Testing

```bash
npm run lint         # ESLint — 0 errors expected
npm run typecheck    # TypeScript — all workspaces
npm run test         # Vitest — integration + unit tests
npm run build        # verifies the app compiles for production
```

The backend test suite covers auth, assets, condition workflows, the maintenance state machine, maintenance transactions, QR, permissions, analytics algorithms, upload security, rate limiting, logging and metrics.

> Coverage instrumentation (`vitest --coverage`) is not configured; see **Roadmap**.

---

## Deployment

- **Windows & Linux server deployment**, PostgreSQL setup, upgrade/rollback — [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **Reverse proxy** examples for Nginx, Apache and IIS — [docs/proxy](docs/proxy).
- **HTTPS** — direct TLS (`HTTPS_ENABLED`) or TLS termination at the proxy with `TRUST_PROXY=1`.
- **Desktop launcher** for end users and the developer launcher — [docs/LAUNCHER.md](docs/LAUNCHER.md).

---

## Backup

- **Database** — `pg_dump` custom-format backups; scheduled (`BACKUP_INTERVAL_MINUTES`) or manual via `POST /api/v1/backups/database`; retention-based rotation.
- **Uploads** — snapshot/`tar.gz` backups of `storage/uploads` with integrity verification, via `POST /api/v1/backups/uploads`.

Both require the `backup.manage` permission. See **[docs/BACKUP.md](docs/BACKUP.md)** and **[docs/RESTORE.md](docs/RESTORE.md)**.

---

## Release

```bash
# 1. Run the full production build
npm run build:prod

# 2. Assemble the release folder (build + SEA launcher + runtime deps)
npm run package:release

# 3. Validate artifacts
npm run check:prod

# 4. Build the installer (requires Inno Setup 6)
npm run build:installer
```

The release is produced in `release/` (gitignored) and the installer in `dist-installer/`. Walk through [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) before shipping.

---

## Roadmap

### Completed

- [x] Inventory, asset management, QR, assignment & movement
- [x] Preventive & corrective maintenance with scheduling and calendar
- [x] Ticket system and notification center
- [x] Dashboard, reports (XLSX export) and analytics
- [x] Audit logs, users, roles and RBAC
- [x] Security hardening (upload validation, rate limiting, input validation, XSS/SQLi review)
- [x] Production readiness (health endpoints, logging, backups, HTTPS/proxy support)
- [x] Advanced analytics (health score, repeated-failure detection, replacement recommendations)
- [x] Desktop launchers (production + developer) and Inno Setup installer

### Future improvements

- [ ] Configure automated coverage reporting (`vitest --coverage`) and enforce a coverage gate
- [ ] Add frontend component/E2E test harness (Testing Library + Playwright)
- [ ] Email/WebSocket push notifications
- [ ] Multi-tenant / organizational scoping
- [ ] Magic-byte (content sniffing) validation for uploads
- [ ] Distributed rate limiting store for multi-instance deployments

---

## Contributing

1. **Coding standards** — follow [docs/CODING_STANDARS.md.txt](docs/CODING_STANDARS.md.txt); run `npm run lint`, `npm run typecheck` and `npm run test` before submitting.
2. **Commit style** — conventional commits, e.g. `feat:`, `fix:`, `chore:`, `docs:`, `test:`; concise subject lines describing the change.
3. **Branch strategy** — feature branches off `main` (`feature/<short-name>`), merged via pull request after a green CI run.
4. **No secrets** — never commit `.env` files, keys or real credentials.

---

## License

Distributed under the **MIT License**. See the `LICENSE` file for details.

---

## Author

**Office Inventory Management System** — built for office IT teams managing enterprise assets.

Maintained by the Office Inventory project team. For support, feature requests or bug reports, please open an issue in the repository.
