# THE CASE FILES — Forensic Investigation Dashboard & Administrator CMS

A modular, reusable criminal investigation game platform engineered to power unlimited independently configurable murder mystery cases from one unified dark cinematic forensic intelligence engine.

## Core Architecture

- **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4**
- **PostgreSQL Dynamic Case Engine (Drizzle ORM)**:
  - All cases, suspects, relationships, evidence exhibits, timelines, sessions, workspace auto-saves, confidential solutions, entitlements, and audit logs live in PostgreSQL (`src/lib/db/schema.ts`).
  - Zero case-specific data is hardcoded inside dashboard components.
  - Supports **production PostgreSQL** via `DATABASE_URL` (`pg`) AND **zero-config embedded PostgreSQL** via `@electric-sql/pglite` (persisted at `./data/pglite`) for instant local execution.
- **Private Object Storage & Signed Asset Delivery** (`src/lib/storage/index.ts`):
  - Supports AWS S3 / Cloudflare R2 / MinIO (`STORAGE_DRIVER=s3`) or local private vault storage outside `public/` (`STORAGE_DRIVER=local`).
  - Assets are delivered via short-lived, user-session-bound HMAC-SHA256 signed tokens (`/api/assets/stream?token=...`) with HTTP `Range` support and `Cache-Control: private, no-store`.
- **Security & Server Authority**:
  - Salted `scrypt` password hashes + database-backed HTTP-only session cookies (`src/lib/auth/index.ts`).
  - Role-Based Access Control (`investigator`, `admin`, `reviewer`) and purchase entitlement validation (`case_entitlements`).
  - **Confidential Answer-Key Isolation**: Stored in `case_solutions`, never queried or serialized in player endpoints, accessed strictly inside Admin CMS and the server-side scoring engine (`src/lib/engine/scoring.ts`).
  - **Server-Authoritative 4-Hour Timer** (`src/lib/engine/timer.ts`): Starts only upon explicit investigator action, persists across reloads/logouts, resists client clock tampering, enforces configurable expiry policies, and supports audited administrative extensions.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The database and private forensic assets for two distinct published cases (`CF-2026-041` **The Ashford Estate Homicide** and `CF-2026-088` **The Meridian Night Express**) seed automatically on first run.

### Demo Evaluation Accounts
- **Investigator**: `detective@casefiles.local` / `DetectivePassword123!` (Entitled to Case 1; Case 2 demonstrates purchase entitlement gating & unlock).
- **Administrator CMS**: `admin@casefiles.local` / `AdminPassword123!` (Full CMS access at `/admin`).

## Production PostgreSQL + S3 / MinIO Deployment

1. Start PostgreSQL 16 and MinIO locally (or point `.env` to managed PostgreSQL + S3/R2):
   ```bash
   docker compose up -d
   ```
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`, `SESSION_SECRET`, `ASSET_SIGNING_SECRET`, and `STORAGE_DRIVER=s3`.
3. Seed sample cases and verify validation checks:
   ```bash
   npm run db:seed
   npm run validate:cases
   ```

## Testing & Verification

```bash
npm run typecheck
npm test
npm run validate:cases
npm run build
```
