# University of North Dakota — VALORANT Team Hub

Private team management, strategy and performance platform for one university VALORANT team.
One deployment serves one team: its own database, accounts, storage and URL.

> **Setup guide in Spanish, step by step, free plans only:** [`docs/SETUP.es.md`](docs/SETUP.es.md)

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Design system, campus hero, auth (invitation codes, reset codes), roles, navigation, Overview dashboard, Settings (branding, members, visitor access, demo data) | **Done** |
| 2 | Map Playbook, Match Center, Opponent Scouting, Team Analytics, CSV/XLSX export | **Done** |
| 3 | Roster, VOD Review, Practice Planner (and Player Development, later removed) | **Done** |
| 4 | Content-Security-Policy, notifications, automatic migrations, end-to-end tests, responsive review, deployment | **Done** |

| 5 | Tactics boards (ValoPlant-style drawings on the map), self-service profiles | **Done** |
| 7 | Map Playbook as the coach works: per map a gameplan (attack/defense) and how we read the map; each strategy with its own board, text, strong and weak points | **Done** |
| 6 | Player pages become performance pages (matches played, filters, per-agent/per-map analysis, head-to-head radar); Player Development removed | **Done** |

### Player pages

`/roster/<player>` lists every map the player has a scoreboard line in, switchable between all matches, practice
(scrims) and officials (official + tournament), filterable by map and agent. It breaks performance down by agent, by
map and agent × map (ACS, win rate, K/D, kills per round, ADR), and compares any two picks (map + agent) side by side
with a radar on fixed scales (350 ACS, 2.0 K/D, 1.2 KPR, 100% wins). The numbers come from `src/lib/stats/player.ts`.

Player Development (feedback, goals, team objectives) was removed at the team's request: its pages redirect to the
roster and nothing shows it, but the tables and any stored rows remain in the database.

### Tactics boards

ValoPlant can't be embedded in another site (it sends `frame-ancestors 'self'`), so the hub has its own board:
minimaps with callouts and agent/ability icons from valorant-api.com, agents and utility for both teams, freehand,
arrows, lines, zones, text, markers and numbered steps, rotation, undo/redo, and a background image (paste a ValoPlant
export or a screenshot with Ctrl+V). Staff draw; everyone who can see the record sees the board. Boards hang off a map
(Playbook), a strategy, an opponent (Scouting), a VOD review, a practice session or a match; `/boards` lists them all.

On save, the editor paints the board on a canvas and uploads it to Storage (`media/boards/`), which gives thumbnails
and the download. The drawing itself is stored as JSON (`boards.scene`, validated by `src/lib/boards/scene.ts`), so
boards stay editable and render sharply at any size.

Next: a second deployment for Hawaii UHE (see the end).

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
- **Self-service:** every member edits their own name and photo; a linked player edits their own roster profile
  (nickname, photo, real name, agent pool) but not their team role or the staff's notes. Members upload only into
  `media/people/<their id>/`.
- **Coach notes** on matches are staff-only.
- **Visitor (read-only) mode:** the owner chooses which sections anyone with the link may view. Playbook, scouting
  and VOD review start private. Settings can never be public. Visitors can't write anything.
- **Password resets** use one-time codes created by the owner or a coach (no email service needed).
- The first owner uses the one-time code printed at the end of `supabase/setup.sql` (valid 2 days; run
  `select app.create_owner_invitation();` in the SQL editor for a new one while there is no owner). Alternatively,
  set `SETUP_TOKEN` and use `/setup`. Both lock once an owner exists.
- **Content-Security-Policy** and other security headers (`next.config.ts`): scripts only from the site itself,
  frames only from YouTube's privacy-enhanced domain, the site can't be framed.
- The last active owner can't be demoted, blocked or deleted.

## Project layout

```
src/app/(auth)/        login, join (invitation code), reset (reset code), setup (first owner)
src/app/(hub)/         the app: overview, the ten sections and notifications
src/app/(hub)/settings team & branding, members, visitor access, data, catalogue (maps, agents, roles), account
src/app/export/        CSV / Excel exports (members only)
src/components/        shell (sidebar, mobile menu), overview widgets, UI primitives
src/lib/db.ts          Postgres access with RLS (withActor / asSystem)
src/lib/migrate.ts     applies pending migrations on start-up (tracked in app.schema_migrations)
src/lib/auth/          viewer resolution, role checks, invitation/reset codes
src/lib/stats/         match statistics (pure functions + unit tests)
src/lib/boards/        tactics board model, geometry and canvas export
src/components/boards/ board editor, SVG renderer, thumbnails
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

Apply the database once: paste `supabase/setup.sql` into the Supabase SQL editor (new project). The app can also
build an empty database by itself on first start.

**Changing the database:** add a new file to `supabase/migrations` (never edit one that has shipped), make it safe to
run twice (`if not exists`, `create or replace`), then run `npm run db:bundle`. That regenerates `setup.sql` and
`src/lib/migrations.generated.ts`; after the next deploy the server applies the new file once, inside a transaction.

## Tests

```bash
npm run lint && npm run typecheck
npm test                                     # unit tests
TEST_DATABASE_URL=postgres://... npm test    # + database security tests
```

The flows were also checked end to end in Chrome (Playwright) on a fresh database: sign-in, invitations, resets,
visitor mode, matches, playbook, tactics boards, player pages, VOD, practice, exports and mobile layouts.

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
