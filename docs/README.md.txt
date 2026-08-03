# Office Inventory Maintenance System

Internal web application untuk membantu Tim IT mengelola, memonitor, dan melakukan maintenance seluruh inventaris kantor.

Sistem dirancang bukan hanya sebagai database inventaris, tetapi sebagai pusat monitoring kondisi aset yang menyimpan:

* Identitas aset
* Lokasi aset
* PIC / pengguna aset
* Kondisi terkini
* Riwayat perubahan kondisi
* Riwayat perpindahan
* Riwayat maintenance
* Preventive maintenance
* QR Code
* Ticket
* Dokumen
* Audit log

---

# 1. Project Status

```text
STATUS: PLANNING COMPLETE
DEVELOPMENT: READY TO START
CURRENT TASK: TASK-001
```

Core documentation:

```text
docs/
├── PRD.md
├── DATABASE.md
├── UI_UX.md
├── API.md
├── CODING_STANDARDS.md
└── TASK.md
```

Seluruh developer dan coding agent wajib membaca dokumentasi terkait sebelum melakukan perubahan.

---

# 2. Main Objective

Tujuan utama sistem:

```text
KNOW THE ASSET
      ↓
KNOW ITS LOCATION
      ↓
KNOW ITS CONDITION
      ↓
KNOW ITS HISTORY
      ↓
MAINTAIN IT
      ↓
PREVENT FAILURE
```

Fokus utama aplikasi adalah:

```text
ASSET CONDITION MONITORING
+
MAINTENANCE MANAGEMENT
```

---

# 3. Primary Users

Pengguna utama:

```text
IT Team
```

Default roles:

```text
SUPER_ADMIN
IT_ADMIN
TECHNICIAN
VIEWER
```

Authorization menggunakan permission-based access control.

Contoh:

```text
asset.read
asset.create
asset.update

maintenance.read
maintenance.create
maintenance.complete

report.read
report.export

admin.audit.read
```

Backend adalah authority terakhir untuk permission checking.

---

# 4. Core Features

## Dashboard

Menampilkan:

```text
Total Assets
Good Assets
Fair Assets
Need Attention
Broken Assets
Critical Assets
Assets in Maintenance

Maintenance Due
Maintenance Overdue

Critical Asset List
Recent Activity
```

---

## Inventory

Mendukung:

```text
Asset Registration
Asset Search
Asset Filter
Asset Detail
Asset Photo
Asset Documents
Asset Assignment
Asset Movement
Asset History
```

---

## Condition Monitoring

Default conditions:

```text
GOOD
FAIR
NEED_ATTENTION
BROKEN
CRITICAL
RETIRED
```

Setiap perubahan condition menyimpan:

```text
Previous Condition
New Condition
Reason
Notes
Changed By
Timestamp
```

---

## QR Asset System

Setiap asset memiliki QR identifier.

Workflow:

```text
SCAN QR
   ↓
ASSET LOOKUP
   ↓
ASSET QUICK VIEW
   ↓
CURRENT CONDITION
   ↓
QUICK ACTION
```

Quick actions dapat berupa:

```text
View Detail
Update Condition
Create Maintenance
```

sesuai permission.

Manual asset-code lookup harus tersedia jika kamera tidak dapat digunakan.

---

# 5. Maintenance

Maintenance workflow:

```text
OPEN
  ↓
ASSIGNED
  ↓
IN_PROGRESS
  │
  ├── WAITING_PART
  │        ↓
  │   IN_PROGRESS
  │
  ↓
TESTING
  ↓
COMPLETED
```

Maintenance menyimpan:

```text
Asset
Problem
Diagnosis
Action Taken
Technician
Vendor
Parts
Labor Cost
Other Cost
Total Cost
Documents
Result
Status
```

---

# 6. Preventive Maintenance

Sistem dapat menyimpan jadwal maintenance berdasarkan:

```text
Asset
Maintenance Type
Frequency
Next Maintenance Date
Reminder Days
```

Monitoring:

```text
Due Today
Due Soon
Upcoming
Overdue
```

---

# 7. Asset History

Sistem harus mempertahankan history.

Contoh:

```text
Asset
 │
 ├── Condition History
 │
 ├── Assignment History
 │
 ├── Movement History
 │
 ├── Maintenance History
 │
 ├── Ticket History
 │
 └── Documents
```

Perubahan current state tidak boleh menghapus historical state.

---

# 8. Audit Trail

Action penting harus masuk audit log.

Contoh:

```text
CREATE_ASSET

UPDATE_ASSET

UPDATE_CONDITION

ASSIGN_ASSET

TRANSFER_ASSET

CREATE_MAINTENANCE

START_MAINTENANCE

COMPLETE_MAINTENANCE

RETIRE_ASSET

DISPOSE_ASSET
```

Audit log membantu menjawab:

```text
WHO

DID WHAT

TO WHICH RESOURCE

WHEN
```

---

# 9. Technology Stack

## Frontend

```text
React
Vite
TypeScript
Tailwind CSS

React Router
TanStack Query
TanStack Table

React Hook Form
Zod

Sonner
Lucide React
Recharts
date-fns
```

---

## Backend

```text
Node.js
Express.js
TypeScript

Zod

PostgreSQL

JWT Authentication
Permission-based Authorization
```

Recommended supporting packages:

```text
Helmet
CORS
Pino
Argon2
Multer
```

---

# 10. Database

Database:

```text
PostgreSQL
```

PostgreSQL adalah:

```text
SOURCE OF TRUTH
```

untuk application data.

Database design tersedia pada:

```text
docs/DATABASE.md
```

---

# 11. API

API style:

```text
REST
```

Version:

```text
/api/v1
```

Development example:

```text
http://localhost:3000/api/v1
```

Health endpoint:

```text
GET /api/v1/health
```

API contract tersedia di:

```text
docs/API.md
```

---

# 12. Recommended Project Structure

```text
office-inventory/
│
├── apps/
│   │
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── api/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   │
│   ├── shared/
│   └── config/
│
├── docs/
│   ├── PRD.md
│   ├── DATABASE.md
│   ├── UI_UX.md
│   ├── API.md
│   ├── CODING_STANDARDS.md
│   └── TASK.md
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

---

# 13. Frontend Architecture

Recommended:

```text
apps/web/src/
│
├── app/
│   ├── router/
│   ├── providers/
│   └── config/
│
├── components/
│   ├── ui/
│   └── layout/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── inventory/
│   ├── maintenance/
│   ├── tickets/
│   ├── reports/
│   ├── master-data/
│   └── administration/
│
├── hooks/
├── lib/
├── services/
├── types/
├── utils/
├── assets/
├── App.tsx
└── main.tsx
```

Frontend menggunakan feature-based architecture.

---

# 14. Backend Architecture

Recommended:

```text
apps/api/src/
│
├── config/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── assets/
│   ├── maintenance/
│   ├── tickets/
│   ├── dashboard/
│   ├── reports/
│   ├── notifications/
│   ├── audit/
│   └── master-data/
│
├── middleware/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── client.ts
│
├── lib/
├── utils/
├── types/
├── app.ts
└── server.ts
```

Application flow:

```text
ROUTE
  ↓
MIDDLEWARE
  ↓
CONTROLLER
  ↓
SERVICE
  ↓
REPOSITORY
  ↓
POSTGRESQL
```

---

# 15. Requirements

Development machine requires:

```text
Node.js
npm
PostgreSQL
Git
```

Recommended:

```text
Node.js 22 LTS or project-pinned compatible version
PostgreSQL 16+
```

Use the version pinned by the project configuration once development begins.

---

# 16. Clone Project

```bash
git clone <repository-url>

cd office-inventory
```

---

# 17. Install Dependencies

From project root:

```bash
npm install
```

If workspace configuration requires individual installation, follow the package manager configuration committed to the repository.

Do not mix package managers.

If project uses npm:

```text
npm
```

continue using npm.

---

# 18. Environment Setup

Copy:

```text
.env.example
```

into local environment files required by the frontend/backend setup.

Example:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Never commit:

```text
.env
```

---

# 19. Database Setup

Create PostgreSQL database.

Example database name:

```text
office_inventory
```

Set:

```text
DATABASE_URL
```

Example pattern:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Use actual local credentials in `.env`.

Do not place real credentials in:

```text
.env.example
README.md
Git
```

---

# 20. Database Migration

After configuring database:

```bash
npm run db:migrate
```

The final command may depend on the selected database library.

Use the project scripts defined in `package.json`.

---

# 21. Database Seed

Development:

```bash
npm run db:seed
```

Seed may create:

```text
Default Roles
Default Permissions
Development Master Data
Development Admin
```

Production must not use known default credentials.

---

# 22. Start Development

Recommended:

```bash
npm run dev
```

or separately:

```bash
npm run dev:web
```

and:

```bash
npm run dev:api
```

---

# 23. Development URLs

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:3000
```

API:

```text
http://localhost:3000/api/v1
```

Health:

```text
http://localhost:3000/api/v1/health
```

Ports may be changed through environment configuration.

---

# 24. Development Database

Recommended:

```text
office_inventory_dev
```

Testing:

```text
office_inventory_test
```

Production:

```text
office_inventory
```

Do not run automated destructive tests against production database.

---

# 25. Required Commands

Project should eventually provide:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run format
```

Database:

```bash
npm run db:migrate
npm run db:seed
```

Optional:

```bash
npm run db:studio
```

depending on selected database tooling.

---

# 26. Build

Before deployment:

```bash
npm run lint

npm run typecheck

npm run test

npm run build
```

Production deployment must not proceed if critical validation fails.

---

# 27. API Response Standard

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

Frontend should use:

```text
error.code
```

for application logic.

---

# 28. Authentication

Protected API:

```text
Authorization: Bearer <access_token>
```

Authentication architecture must follow:

```text
docs/API.md
```

Password must:

```text
Never be stored as plaintext
Never be logged
Never be returned
```

---

# 29. Environment Security

Never commit:

```text
.env

Database Password

JWT Secret

API Keys

Production Credentials

Private Certificates
```

If a secret is accidentally committed:

```text
REMOVE FROM REPOSITORY
+
ROTATE SECRET
```

Removing the line alone is not sufficient.

---

# 30. Upload Storage

Development may use local storage:

```text
storage/
```

Production storage must be persistent.

Do not rely on temporary application filesystem if deployment platform deletes files during redeployment.

Supported asset uploads may include:

```text
Asset Photo
Maintenance Before Photo
Maintenance After Photo
Invoice
Service Report
Asset Document
```

---

# 31. Upload Security

Backend must validate:

```text
MIME type
Extension
File size
Authorization
Filename
Ownership
```

Recommended image formats:

```text
JPEG
PNG
WEBP
```

Recommended document format:

```text
PDF
```

---

# 32. Logging

Backend should use structured logging.

Recommended:

```text
Pino
```

Each request should include:

```text
requestId
method
route
status
duration
userId
```

Never log:

```text
Password
JWT
Cookie
Authorization Header
Database Password
Secrets
```

---

# 33. Coding Standards

All implementation must follow:

```text
docs/CODING_STANDARDS.md
```

Core rule:

```text
UNDERSTAND
   ↓
PLAN
   ↓
IMPLEMENT
   ↓
TEST
   ↓
VERIFY
```

Not:

```text
GUESS
 ↓
REWRITE
```

---

# 34. Existing Feature Protection

Do not modify unrelated working functionality while implementing a task.

Use:

```text
SMALLEST SAFE CHANGE
```

for bug fixes.

Large refactors must be separate tasks.

---

# 35. Database Change

Database changes require:

```text
Update DATABASE.md if design changed
       ↓
Create migration
       ↓
Update application
       ↓
Test migration
```

Do not manually alter production schema as normal development workflow.

---

# 36. API Change

API changes require:

```text
Update API.md
       ↓
Update Backend
       ↓
Update Frontend
       ↓
Update Tests
```

---

# 37. UI Change

Major user-flow changes require:

```text
Update UI_UX.md
       ↓
Implement
       ↓
Verify Desktop
       ↓
Verify Mobile
```

---

# 38. Git Branch Convention

Recommended:

```text
feature/inventory
feature/maintenance
feature/qr-scanner

fix/asset-condition
fix/mobile-navigation

refactor/asset-service
```

---

# 39. Commit Convention

Recommended:

```text
feat:
fix:
refactor:
docs:
test:
chore:
```

Examples:

```text
feat: add asset condition history

fix: prevent duplicate maintenance completion

docs: update maintenance API
```

---

# 40. Development Roadmap

Full roadmap:

```text
docs/TASK.md
```

Main progression:

```text
FOUNDATION
    ↓
DATABASE
    ↓
AUTH
    ↓
MASTER DATA
    ↓
INVENTORY
    ↓
CONDITION
    ↓
QR
    ↓
MAINTENANCE
    ↓
DASHBOARD
    ↓
OPERATIONS
    ↓
REPORTING
    ↓
TESTING
    ↓
PRODUCTION
```

---

# 41. Current Development Starting Point

Start from:

```text
TASK-001
```

Initial sprint:

```text
TASK-001 Repository

TASK-002 Frontend

TASK-003 Backend

TASK-004 Root Scripts

TASK-005 TypeScript

TASK-006 ESLint / Prettier

TASK-007 Environment

TASK-010 PostgreSQL

TASK-011 Migration

TASK-012 Master Tables

TASK-013 Asset Tables

TASK-018 Base Seed
```

Do not start advanced features before foundation is stable.

---

# 42. MVP

MVP must allow IT to:

```text
Login

View Dashboard

Register Asset

Search Asset

Filter Asset

View Asset Detail

Scan Asset QR

View Condition

Update Condition

View Condition History

Create Maintenance

Assign Technician

Start Maintenance

Complete Maintenance

View Maintenance History

Monitor Critical Assets

Monitor Upcoming Maintenance
```

---

# 43. MVP Core Workflow

```text
LOGIN
   ↓
DASHBOARD
   ↓
CRITICAL ASSET
   ↓
ASSET DETAIL
   ↓
CREATE MAINTENANCE
   ↓
ASSIGN
   ↓
START
   ↓
REPAIR
   ↓
TEST
   ↓
COMPLETE
   ↓
CONDITION UPDATED
   ↓
HISTORY
   ↓
AUDIT
```

---

# 44. QR Core Workflow

```text
OPEN SCANNER
      ↓
SCAN QR
      ↓
ASSET FOUND
      ↓
QUICK VIEW
      ↓
UPDATE CONDITION
or
CREATE MAINTENANCE
```

---

# 45. Definition of Done

A task is not complete because UI exists.

A task is complete when relevant requirements pass:

```text
Functionality

Validation

Authorization

Error Handling

Loading State

History

Audit

Responsive UI

Tests

Typecheck

Build
```

---

# 46. Production Requirements

Before production:

```text
HTTPS

Secure JWT secret

Production PostgreSQL

Database backup

Persistent file storage

CORS configuration

Rate limiting

Security headers

Production logging

Health monitoring

Secure admin account
```

---

# 47. Backup

Database backup strategy must define:

```text
Frequency
Retention
Storage
Restore Procedure
Restore Testing
```

Uploaded documents/photos require separate backup if not stored inside managed persistent object storage.

---

# 48. Documentation

Before implementing a feature, determine which document owns the requirement:

```text
PRD.md
→ WHAT

DATABASE.md
→ DATA

UI_UX.md
→ EXPERIENCE

API.md
→ CONTRACT

CODING_STANDARDS.md
→ IMPLEMENTATION RULES

TASK.md
→ EXECUTION ORDER
```

---

# 49. Coding Agent Instruction

When using a coding agent:

```text
Read:

docs/PRD.md
docs/DATABASE.md
docs/UI_UX.md
docs/API.md
docs/CODING_STANDARDS.md
docs/TASK.md

Implement only the requested TASK.

Do not:
- Invent requirements.
- Change unrelated features.
- Change API contracts silently.
- Change database schema without migration.
- Hard-code secrets.
- Disable TypeScript errors.
- Introduce unnecessary dependencies.

After implementation:
- Run lint.
- Run typecheck.
- Run relevant tests.
- Run build.

Report:
- Files created.
- Files modified.
- Migrations created.
- Endpoints added.
- Tests performed.
- Build result.
- Remaining issues.
```

---

# 50. Project Principle

This application must always be able to answer:

```text
WHAT IS THE ASSET?

WHERE IS THE ASSET?

WHO IS USING IT?

WHAT CONDITION IS IT IN?

WHAT HAS HAPPENED TO IT?

WHAT MAINTENANCE HAS BEEN DONE?

WHO MADE EACH IMPORTANT CHANGE?
```

The system is not designed merely to count inventory.

It is designed to:

```text
MONITOR
   ↓
DETECT
   ↓
MAINTAIN
   ↓
TRACK
   ↓
PREVENT
```

office asset problems.

---

# 51. Documentation Status

```text
PRD.md                 COMPLETE
DATABASE.md            COMPLETE
UI_UX.md               COMPLETE
API.md                 COMPLETE
CODING_STANDARDS.md    COMPLETE
TASK.md                 COMPLETE
README.md               COMPLETE
.env.example            COMPLETE
```

Project planning foundation:

```text
READY
```

Next step:

```text
TASK-001
PROJECT INITIALIZATION
```
