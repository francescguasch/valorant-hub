# University of North Dakota — VALORANT Team Hub

Private team management, strategy and performance platform for one university VALORANT team.
One deployment serves one team: its own database, accounts, storage and URL.

> **Setup guide in Spanish, step by step, free plans only:** [`docs/SETUP.es.md`](docs/SETUP.es.md)

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Design system, campus hero, auth (invitation codes, reset codes), roles, navigation, Overview dashboard, Settings (branding, members, visitor access, demo data) | **Done** |
| 2 | Map Playbook, Match Center, Opponent Scouting, Team Analytics, CSV/XLSX export | Next |
| 3 | Roster, Player Development, VOD Review, Practice Planner | Planned |
| 4 | Security review, tests, responsive polish, deployment | Planned |

The database schema for all phases is already in place, with Row Level Security.

## Stack

- **Next.js 16** (App Router, server actions) + **TypeScript** + **Tailwind CSS 4**
- **Supabase**: Auth (email + password), Postgres, Storage
- **Vercel** for hosting (Hobby plan is enough)

Everything runs on free plans.

### Why the app talks to Postgres directly

Pages and server actions query Postgres with [`postgres`](https://github.com/porsager/postgres) instead of the
Supabase REST API. Each query runs in a transaction that switches to Supabase's `authenticated` (or `anon`) role
and sets the user id exactly as Supabase does (`src/lib/db.ts → withActor`). Row Level Security therefore applies
to every query the app makes, and the statistics can use plain SQL. The browser only talks to Supabase for sign-in
cookies and image uploads.

## Security model

- **No public sign-up.** Accounts are created with a single-use invitation code (owner: any role, coach: players
  only). Only a SHA-256 hash of each code is stored.
- **Roles:** `owner`, `coach`, `player`, enforced in the database by RLS policies and triggers
  (`supabase/migrations/20261124000200_security.sql`), and checked again in every server action.
- **Private feedback** is readable only by the staff and the player it belongs to.
- **Coach notes** on matches are staff-only.
- **Visitor (read-only) mode:** the owner chooses which sections anyone with the link may view. Playbook, scouting
  and VOD review start private. Player Development and Settings can never be public. Visitors can't write anything.
- **Password resets** use one-time codes created by the owner or a coach (no email service needed).
- The first owner is created at `/setup` with the `SETUP_TOKEN` secret; the page locks once an owner exists.
- The last active owner can't be demoted, blocked or deleted.

## Project layout

```
src/app/(auth)/        login, join (invitation code), reset (reset code), setup (first owner)
src/app/(hub)/         the app: overview and the ten sections
src/app/(hub)/settings team & branding, members, visitor access, data, your account
src/components/        shell (sidebar, mobile menu), overview widgets, UI primitives
src/lib/db.ts          Postgres access with RLS (withActor / asSystem)
src/lib/auth/          viewer resolution, role checks, invitation/reset codes
src/lib/stats/         match statistics (pure functions + unit tests)
supabase/migrations/   schema, security, catalogue seed, demo data
supabase/setup.sql     all migrations in one file, for the Supabase SQL editor
tests/                 database security tests
.github/workflows/     CI (lint, types, tests) and twice-weekly database backup
```

## Local development

Requirements: Node 20.9+, a Supabase project (free) or the Supabase CLI with Docker.

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

Apply the database once: paste `supabase/setup.sql` into the Supabase SQL editor (new project), or run the files in
`supabase/migrations` in order. After changing migrations run `npm run db:bundle` to regenerate `setup.sql`.

## Tests

```bash
npm run lint && npm run typecheck
npm test                                     # unit tests
TEST_DATABASE_URL=postgres://... npm test    # + database security tests
```

The security tests need a throwaway Postgres with Supabase's roles: run `supabase/tests/supabase_stub.sql` and then
the migrations on it (CI does this automatically). **Never point `TEST_DATABASE_URL` at the real project.**

## Demo data

The setup loads clearly marked DEMO opponents, matches, objectives and practice sessions. No demo data touches the
real players. Remove it in **Settings → Data** (owner) before entering real results.

## Reusing this for another university (e.g. Hawaii UHE)

1. Create a new GitHub repository from this code, a **new** Supabase project and a **new** Vercel project.
2. Run `supabase/setup.sql` in the new project, after editing the roster block in
   `supabase/migrations/20261124000300_seed_catalog.sql` (then `npm run db:bundle`).
3. Change `team_settings` defaults (university name, campus photo) in the core schema, or simply edit them in
   **Settings → Team & branding** after the first login, and upload that university's own photo.
4. Use new secrets everywhere. Nothing is shared between the two deployments.
