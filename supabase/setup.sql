-- =============================================================================
-- VALORANT Team Hub: complete database setup for a NEW Supabase project.
-- Generated from supabase/migrations by `npm run db:bundle`. Do not edit by hand.
-- Paste everything into Supabase → SQL Editor → New query, then press Run.
-- =============================================================================

-- >>> 20261124000100_core_schema.sql
-- =============================================================================
-- VALORANT Team Hub — core schema
-- One deployment = one team. Every table lives in `public`; helper functions
-- live in the private `app` schema (not exposed through the Supabase Data API).
-- =============================================================================

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'coach', 'player');
create type public.match_type as enum ('scrim', 'official', 'tournament');
create type public.agent_role as enum ('duelist', 'initiator', 'controller', 'sentinel');
create type public.strategy_side as enum ('t', 'ct');
create type public.strategy_status as enum ('in_development', 'practicing', 'approved');

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Canonical composition id: the five agent ids sorted, so order never matters.
create or replace function app.comp_key(ids uuid[]) returns text
language sql immutable as $$
  select string_agg(x::text, '.' order by x::text) from unnest(ids) as x
$$;

-- Academic season (July–June), e.g. 2026-10-03 -> '2026/2027'.
create or replace function app.season_for(d date) returns text
language sql immutable as $$
  select case when extract(month from d) >= 7
    then extract(year from d)::int || '/' || (extract(year from d)::int + 1)
    else (extract(year from d)::int - 1) || '/' || extract(year from d)::int end
$$;

-- -----------------------------------------------------------------------------
-- Team settings (single row)
-- -----------------------------------------------------------------------------
create table public.team_settings (
  id boolean primary key default true check (id),
  university_name text not null default 'University of North Dakota',
  team_name text not null default 'VALORANT Team',
  hero_kicker text not null default 'University esports · Competitive division',
  hero_tagline text not null default 'Team management · Performance · Strategy',
  season_label text not null default '2026 / 2027',
  logo_url text,
  hero_image_url text not null default '/brand/campus-und.jpg',
  accent_color text not null default '#FF4655' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#ECE8E1' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'America/Chicago',
  public_view_enabled boolean not null default true,
  public_sections text[] not null default '{overview,matches,analytics,roster}',
  updated_at timestamptz not null default now()
);
insert into public.team_settings default values;
create trigger team_settings_touch before update on public.team_settings
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Catalogues: roles, agents, maps
-- -----------------------------------------------------------------------------
create table public.team_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index team_roles_name_key on public.team_roles (lower(name));

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role public.agent_role not null,
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index agents_name_key on public.agents (lower(name));

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  in_rotation boolean not null default false,
  active boolean not null default true,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index maps_name_key on public.maps (lower(name));

-- Tactical notes for a map (part of the private playbook).
create table public.map_notes (
  map_id uuid primary key references public.maps (id) on delete cascade,
  overview text,
  characteristics text,
  important_areas text,
  callouts text,
  strengths text,
  weaknesses text,
  recommended_comps text,
  callouts_image_url text,
  updated_at timestamptz not null default now()
);
create trigger map_notes_touch before update on public.map_notes
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Players and accounts
-- -----------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  photo_url text,
  main_role_id uuid references public.team_roles (id) on delete set null,
  secondary_role_id uuid references public.team_roles (id) on delete set null,
  main_agent_ids uuid[] not null default '{}',
  secondary_agent_ids uuid[] not null default '{}',
  active boolean not null default true,
  sort_order int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index players_nickname_key on public.players (lower(nickname));
create trigger players_touch before update on public.players
  for each row execute function app.touch_updated_at();

-- Team-only details (never shown in the public read-only view).
create table public.player_details (
  player_id uuid primary key references public.players (id) on delete cascade,
  real_name text,
  strengths text,
  weaknesses text,
  notes text,
  updated_at timestamptz not null default now()
);
create trigger player_details_touch before update on public.player_details
  for each row execute function app.touch_updated_at();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  role public.app_role not null default 'player',
  player_id uuid unique references public.players (id) on delete set null,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_hint text not null,
  role public.app_role not null,
  player_id uuid references public.players (id) on delete set null,
  email text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);

create table public.reset_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- -----------------------------------------------------------------------------
-- Opponents and matches
-- -----------------------------------------------------------------------------
create table public.opponents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  logo_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index opponents_name_key on public.opponents (lower(name));

create table public.opponent_notes (
  opponent_id uuid primary key references public.opponents (id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);
create trigger opponent_notes_touch before update on public.opponent_notes
  for each row execute function app.touch_updated_at();

-- One row = one map played. Several rows share a series_id for BO3/BO5.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  played_on date not null,
  season text not null,
  competition text,
  match_type public.match_type not null,
  opponent_id uuid not null references public.opponents (id) on delete restrict,
  series_id text,
  series_format text check (series_format in ('BO1', 'BO3', 'BO5')),
  map_number smallint check (map_number between 1 and 5),
  map_id uuid not null references public.maps (id) on delete restrict,
  our_agent_ids uuid[] not null check (cardinality(our_agent_ids) = 5),
  opp_agent_ids uuid[] not null check (cardinality(opp_agent_ids) = 5),
  our_comp_key text not null,
  opp_comp_key text not null,
  our_t_rounds smallint not null check (our_t_rounds between 0 and 12),
  our_ct_rounds smallint not null check (our_ct_rounds between 0 and 12),
  opp_t_rounds smallint not null check (opp_t_rounds between 0 and 12),
  opp_ct_rounds smallint not null check (opp_ct_rounds between 0 and 12),
  our_ot_rounds smallint not null default 0 check (our_ot_rounds >= 0),
  opp_ot_rounds smallint not null default 0 check (opp_ot_rounds >= 0),
  our_score smallint generated always as (our_t_rounds + our_ct_rounds + our_ot_rounds) stored,
  opp_score smallint generated always as (opp_t_rounds + opp_ct_rounds + opp_ot_rounds) stored,
  round_diff smallint generated always as
    ((our_t_rounds + our_ct_rounds + our_ot_rounds) - (opp_t_rounds + opp_ct_rounds + opp_ot_rounds)) stored,
  result char(1) generated always as (case
    when (our_t_rounds + our_ct_rounds + our_ot_rounds) > (opp_t_rounds + opp_ct_rounds + opp_ot_rounds) then 'W'
    when (our_t_rounds + our_ct_rounds + our_ot_rounds) < (opp_t_rounds + opp_ct_rounds + opp_ot_rounds) then 'L'
    else 'D' end) stored,
  -- Optional round-type metrics (null = not recorded)
  pistols_won smallint check (pistols_won between 0 and 2),
  anti_eco_won smallint check (anti_eco_won >= 0),
  anti_eco_played smallint check (anti_eco_played >= 0),
  bonus_won smallint check (bonus_won >= 0),
  bonus_played smallint check (bonus_played >= 0),
  first_bloods smallint check (first_bloods >= 0),
  first_blood_wins smallint check (first_blood_wins >= 0),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A half has at most 12 rounds: our T rounds + their CT rounds happen in the same half.
  constraint matches_half_one check (our_t_rounds + opp_ct_rounds <= 12),
  constraint matches_half_two check (our_ct_rounds + opp_t_rounds <= 12),
  constraint matches_no_ot_in_scrims check (match_type <> 'scrim' or (our_ot_rounds = 0 and opp_ot_rounds = 0)),
  constraint matches_ot_after_12_12 check ((our_ot_rounds = 0 and opp_ot_rounds = 0)
    or (our_t_rounds + our_ct_rounds = 12 and opp_t_rounds + opp_ct_rounds = 12)),
  constraint matches_no_draw_in_competition check (match_type = 'scrim'
    or (our_t_rounds + our_ct_rounds + our_ot_rounds) <> (opp_t_rounds + opp_ct_rounds + opp_ot_rounds)),
  constraint matches_anti_eco check (anti_eco_won is null or anti_eco_played is null or anti_eco_won <= anti_eco_played),
  constraint matches_bonus check (bonus_won is null or bonus_played is null or bonus_won <= bonus_played),
  constraint matches_first_blood check (first_bloods is null or first_blood_wins is null or first_blood_wins <= first_bloods)
);
create index matches_played_on_idx on public.matches (played_on desc);
create index matches_opponent_idx on public.matches (opponent_id);
create index matches_map_idx on public.matches (map_id);
create index matches_series_idx on public.matches (series_id);

create or replace function app.prepare_match() returns trigger
language plpgsql as $$
begin
  if (select count(distinct x) from unnest(new.our_agent_ids) x) <> 5 then
    raise exception 'Your composition needs five different agents' using errcode = '23514';
  end if;
  if (select count(distinct x) from unnest(new.opp_agent_ids) x) <> 5 then
    raise exception 'The opponent composition needs five different agents' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(new.our_agent_ids || new.opp_agent_ids) x
             where not exists (select 1 from public.agents a where a.id = x)) then
    raise exception 'Unknown agent in composition' using errcode = '23503';
  end if;
  new.our_comp_key := app.comp_key(new.our_agent_ids);
  new.opp_comp_key := app.comp_key(new.opp_agent_ids);
  new.season := app.season_for(new.played_on);
  new.updated_at := now();
  return new;
end $$;
create trigger matches_prepare before insert or update on public.matches
  for each row execute function app.prepare_match();

create table public.match_notes (
  match_id uuid primary key references public.matches (id) on delete cascade,
  notes text,
  vod_url text
);

create table public.match_coach_notes (
  match_id uuid primary key references public.matches (id) on delete cascade,
  notes text
);

create table public.match_player_stats (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  kills smallint check (kills >= 0),
  deaths smallint check (deaths >= 0),
  assists smallint check (assists >= 0),
  acs smallint check (acs >= 0),
  adr numeric(5, 1) check (adr >= 0),
  hs_pct numeric(4, 1) check (hs_pct between 0 and 100),
  first_kills smallint check (first_kills >= 0),
  first_deaths smallint check (first_deaths >= 0),
  primary key (match_id, player_id)
);

-- -----------------------------------------------------------------------------
-- Playbook
-- -----------------------------------------------------------------------------
create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  side public.strategy_side not null,
  category text not null,
  name text not null,
  description text,
  objective text,
  comp_agent_ids uuid[] not null default '{}',
  assignments jsonb not null default '[]'::jsonb,
  starting_positions text,
  utility_usage text,
  timing text,
  callouts text,
  execution text,
  alternatives text,
  common_mistakes text,
  coaching_notes text,
  youtube_url text,
  status public.strategy_status not null default 'in_development',
  archived_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index strategies_map_idx on public.strategies (map_id, side);
create trigger strategies_touch before update on public.strategies
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Development, practice and VOD review
-- -----------------------------------------------------------------------------
create table public.team_objectives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  kind text not null default 'objective' check (kind in ('objective', 'priority')),
  progress smallint not null default 0 check (progress between 0 and 100),
  status text not null default 'active' check (status in ('active', 'done', 'dropped')),
  due_on date,
  sort_order int not null default 0,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger team_objectives_touch before update on public.team_objectives
  for each row execute function app.touch_updated_at();

create table public.player_goals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  description text not null,
  current_level text,
  target text,
  deadline date,
  progress smallint not null default 0 check (progress between 0 and 100),
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'achieved', 'missed')),
  comments text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index player_goals_player_idx on public.player_goals (player_id);
create trigger player_goals_touch before update on public.player_goals
  for each row execute function app.touch_updated_at();

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  duration_min smallint not null default 120 check (duration_min between 15 and 720),
  session_type text not null,
  map_id uuid references public.maps (id) on delete set null,
  strategy_id uuid references public.strategies (id) on delete set null,
  objective text,
  attending_player_ids uuid[] not null default '{}',
  outcome text,
  coach_notes text,
  next_steps text,
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_sessions_starts_idx on public.practice_sessions (starts_at);
create trigger practice_sessions_touch before update on public.practice_sessions
  for each row execute function app.touch_updated_at();

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  given_on date not null default current_date,
  match_id uuid references public.matches (id) on delete set null,
  practice_session_id uuid references public.practice_sessions (id) on delete set null,
  category text not null,
  strengths text,
  areas_to_improve text,
  specific_example text,
  evidence text,
  vod_clip_url text,
  improvement_action text,
  follow_up_on date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_player_idx on public.feedback (player_id, given_on desc);
create trigger feedback_touch before update on public.feedback
  for each row execute function app.touch_updated_at();

create table public.vod_reviews (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  map_id uuid references public.maps (id) on delete set null,
  round_number smallint check (round_number between 1 and 60),
  video_timestamp text,
  clip_url text,
  player_id uuid references public.players (id) on delete set null,
  category text,
  what_happened text not null,
  should_have_happened text,
  improvement_action text,
  assigned_player_id uuid references public.players (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger vod_reviews_touch before update on public.vod_reviews
  for each row execute function app.touch_updated_at();

-- An agent or map that appears in recorded matches can be hidden but not deleted.
create or replace function app.guard_agent_delete() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.matches m where old.id = any (m.our_agent_ids) or old.id = any (m.opp_agent_ids)) then
    raise exception 'This agent appears in recorded matches. Hide it instead of deleting it.' using errcode = '23503';
  end if;
  return old;
end $$;
create trigger agents_guard_delete before delete on public.agents
  for each row execute function app.guard_agent_delete();

-- >>> 20261124000200_security.sql
-- =============================================================================
-- Security: role helpers, Row Level Security and guards.
-- The database is the source of truth for permissions: hiding a button in the
-- interface is never what protects the data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role helpers (security definer so policies can read profiles without recursion)
-- -----------------------------------------------------------------------------
create or replace function app.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and not p.disabled
$$;

create or replace function app.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.my_role() is not null
$$;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_role() in ('owner', 'coach'), false)
$$;

create or replace function app.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_role() = 'owner', false)
$$;

create or replace function app.my_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.player_id from public.profiles p where p.id = auth.uid() and not p.disabled
$$;

-- Read-only public view: is this section open to visitors without an account?
create or replace function app.is_public(section text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.public_view_enabled and section = any (s.public_sections)
                   from public.team_settings s where s.id), false)
$$;

-- Member, or the section is public.
create or replace function app.can_view(sections text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_member() or exists (select 1 from unnest(sections) s where app.is_public(s))
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Table privileges (RLS below decides which rows)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
revoke insert, update, delete, truncate on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------
-- Settings: everyone can read branding; staff edit; access settings guarded below.
create policy settings_read on public.team_settings for select to anon, authenticated using (true);
create policy settings_write on public.team_settings for update to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- Catalogues
create policy roles_read on public.team_roles for select to anon, authenticated using (true);
create policy roles_write on public.team_roles for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy agents_read on public.agents for select to anon, authenticated using (true);
create policy agents_write on public.agents for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy maps_read on public.maps for select to anon, authenticated using (true);
create policy maps_write on public.maps for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- Playbook
create policy map_notes_read on public.map_notes for select to anon, authenticated using (app.can_view('{playbook}'));
create policy map_notes_write on public.map_notes for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy strategies_read on public.strategies for select to anon, authenticated using (app.can_view('{playbook}'));
create policy strategies_write on public.strategies for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- Players
create policy players_read on public.players for select to anon, authenticated
  using (app.can_view('{roster,analytics,matches,overview}'));
create policy players_write on public.players for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy player_details_read on public.player_details for select to authenticated using (app.is_member());
create policy player_details_write on public.player_details for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- Profiles: members see the team list; you edit your own name; the owner manages access.
create policy profiles_read on public.profiles for select to authenticated using (app.is_member() or id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or app.is_owner()) with check (id = auth.uid() or app.is_owner());

-- Invitations and reset codes: owner for everyone, coaches only for players.
create policy invitations_read on public.invitations for select to authenticated using (app.is_staff());
create policy invitations_insert on public.invitations for insert to authenticated
  with check (app.is_owner() or (app.is_staff() and role = 'player'));
create policy invitations_update on public.invitations for update to authenticated
  using (app.is_owner() or (app.is_staff() and role = 'player'))
  with check (app.is_owner() or (app.is_staff() and role = 'player'));
create policy invitations_delete on public.invitations for delete to authenticated using (app.is_owner());

create policy reset_codes_read on public.reset_codes for select to authenticated using (app.is_staff());
create policy reset_codes_insert on public.reset_codes for insert to authenticated
  with check (app.is_owner() or (app.is_staff()
    and exists (select 1 from public.profiles p where p.id = user_id and p.role = 'player')));

-- Opponents and matches
create policy opponents_read on public.opponents for select to anon, authenticated
  using (app.can_view('{matches,overview,analytics,scouting}'));
create policy opponents_write on public.opponents for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy opponent_notes_read on public.opponent_notes for select to anon, authenticated using (app.can_view('{scouting}'));
create policy opponent_notes_write on public.opponent_notes for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy matches_read on public.matches for select to anon, authenticated
  using (app.can_view('{matches,overview,analytics,scouting}'));
create policy matches_write on public.matches for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy match_notes_read on public.match_notes for select to authenticated using (app.is_member());
create policy match_notes_write on public.match_notes for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy match_coach_notes_read on public.match_coach_notes for select to authenticated using (app.is_staff());
create policy match_coach_notes_write on public.match_coach_notes for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy match_player_stats_read on public.match_player_stats for select to anon, authenticated
  using (app.can_view('{matches,analytics,roster}'));
create policy match_player_stats_write on public.match_player_stats for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- Development: goals are visible to the whole team; feedback only to its player and staff.
create policy team_objectives_read on public.team_objectives for select to authenticated using (app.is_member());
create policy team_objectives_write on public.team_objectives for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy player_goals_read on public.player_goals for select to authenticated using (app.is_member());
create policy player_goals_write on public.player_goals for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy feedback_read on public.feedback for select to authenticated
  using (app.is_staff() or (player_id is not null and player_id = app.my_player_id()));
create policy feedback_write on public.feedback for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- Practice and VOD
create policy practice_read on public.practice_sessions for select to anon, authenticated using (app.can_view('{practice}'));
create policy practice_write on public.practice_sessions for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy vod_read on public.vod_reviews for select to anon, authenticated using (app.can_view('{vod}'));
create policy vod_write on public.vod_reviews for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- -----------------------------------------------------------------------------
-- Guards that policies alone can't express
-- -----------------------------------------------------------------------------
-- Only the owner changes roles, linked players or access; the last owner can't be removed.
create or replace function app.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.player_id is distinct from old.player_id
      or new.disabled is distinct from old.disabled or new.email is distinct from old.email
      or new.id is distinct from old.id)
     and auth.uid() is not null and not app.is_owner() then
    raise exception 'Only the team owner can change roles, linked players or account access' using errcode = '42501';
  end if;
  if old.role = 'owner' and (new.role <> 'owner' or new.disabled)
     and not exists (select 1 from public.profiles p where p.role = 'owner' and not p.disabled and p.id <> old.id) then
    raise exception 'The team needs at least one active owner' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function app.guard_profile_update();

create or replace function app.guard_owner_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and not old.disabled
     and not exists (select 1 from public.profiles p where p.role = 'owner' and not p.disabled and p.id <> old.id) then
    raise exception 'The team needs at least one active owner' using errcode = '23514';
  end if;
  return old;
end $$;
create trigger profiles_guard_delete before delete on public.profiles
  for each row execute function app.guard_owner_delete();

-- Public-view settings are a security decision: owner only.
create or replace function app.guard_settings_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.public_view_enabled is distinct from old.public_view_enabled
      or new.public_sections is distinct from old.public_sections)
     and auth.uid() is not null and not app.is_owner() then
    raise exception 'Only the team owner can change what visitors without an account can see' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(new.public_sections) s
             where s not in ('overview', 'playbook', 'matches', 'scouting', 'analytics', 'roster', 'vod', 'practice')) then
    raise exception 'Unknown public section' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger team_settings_guard before update on public.team_settings
  for each row execute function app.guard_settings_update();

-- -----------------------------------------------------------------------------
-- Storage: one public bucket for team media (logos, campus photo, player photos).
-- Anyone can view a file by its URL; only staff can upload, replace or delete.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and app.is_staff());
create policy media_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and app.is_staff());
create policy media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and app.is_staff());

-- >>> 20261124000300_seed_catalog.sql
-- =============================================================================
-- Starting catalogue: roles, agents, maps and the Dakota roster.
-- Everything here is editable from Settings. Nothing is marked as "in
-- rotation": the staff chooses the active competitive pool in Settings.
-- =============================================================================

insert into public.team_roles (name, sort_order) values
  ('Sentinel', 1), ('Initiator', 2), ('Main Entry', 3), ('Second Entry', 4), ('Controller / Smoker', 5);

insert into public.maps (name, sort_order) values
  ('Abyss', 1), ('Ascent', 2), ('Bind', 3), ('Breeze', 4), ('Corrode', 5), ('Fracture', 6), ('Haven', 7),
  ('Icebox', 8), ('Lotus', 9), ('Pearl', 10), ('Split', 11), ('Summit', 12), ('Sunset', 13);

insert into public.agents (name, role, sort_order) values
  ('Astra', 'controller', 1), ('Breach', 'initiator', 2), ('Brimstone', 'controller', 3), ('Chamber', 'sentinel', 4),
  ('Clove', 'controller', 5), ('Cypher', 'sentinel', 6), ('Deadlock', 'sentinel', 7), ('Fade', 'initiator', 8),
  ('Gekko', 'initiator', 9), ('Harbor', 'controller', 10), ('Iso', 'duelist', 11), ('Jett', 'duelist', 12),
  ('KAY/O', 'initiator', 13), ('Killjoy', 'sentinel', 14), ('Neon', 'duelist', 15), ('Omen', 'controller', 16),
  ('Phoenix', 'duelist', 17), ('Raze', 'duelist', 18), ('Reyna', 'duelist', 19), ('Sage', 'sentinel', 20),
  ('Skye', 'initiator', 21), ('Sova', 'initiator', 22), ('Tejo', 'initiator', 23), ('Veto', 'sentinel', 24),
  ('Viper', 'controller', 25), ('Vyse', 'sentinel', 26), ('Waylay', 'duelist', 27), ('Yoru', 'duelist', 28);

-- Roster supplied by the team. Only nickname and main role are known; the rest is left empty on purpose.
insert into public.players (nickname, main_role_id, sort_order)
select v.nickname, r.id, v.sort_order
from (values ('Zach', 'Sentinel', 1), ('JaxaPixel', 'Initiator', 2), ('Stryker', 'Main Entry', 3),
             ('DoubleB', 'Second Entry', 4), ('Justin', 'Controller / Smoker', 5)) as v (nickname, role_name, sort_order)
join public.team_roles r on r.name = v.role_name;

insert into public.player_details (player_id) select id from public.players;

-- >>> 20261124000400_demo_data.sql
-- =============================================================================
-- DEMO data: fictional opponents, matches, objectives and practice sessions so
-- the platform can be tried before real data exists. Every row is flagged
-- is_demo = true and shown with a DEMO badge. Remove it all from
-- Settings → Data, or run:  select app.clear_demo_data();
-- No demo data is attached to real players (no invented stats or feedback).
-- =============================================================================

create or replace function app.agent_ids(names text[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select array_agg(a.id order by n.ord)
  from unnest(names) with ordinality as n (name, ord)
  join public.agents a on lower(a.name) = lower(n.name)
$$;

create or replace function app.clear_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not app.is_owner() then
    raise exception 'Only the team owner can remove demo data' using errcode = '42501';
  end if;
  delete from public.vod_reviews where is_demo;
  delete from public.feedback where is_demo;
  delete from public.player_goals where is_demo;
  delete from public.practice_sessions where is_demo;
  delete from public.team_objectives where is_demo;
  delete from public.strategies where is_demo;
  delete from public.matches where is_demo;
  delete from public.opponents o where o.is_demo
    and not exists (select 1 from public.matches m where m.opponent_id = o.id);
  delete from public.players where is_demo;
end $$;

create or replace function app.load_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  o_red uuid; o_lake uuid; o_granite uuid; o_pine uuid;
  m record;
begin
  if auth.uid() is not null and not app.is_owner() then
    raise exception 'Only the team owner can load demo data' using errcode = '42501';
  end if;
  perform app.clear_demo_data();

  insert into public.opponents (name, is_demo) values ('DEMO Red Valley College', true) returning id into o_red;
  insert into public.opponents (name, is_demo) values ('DEMO Lakeside Tech', true) returning id into o_lake;
  insert into public.opponents (name, is_demo) values ('DEMO Granite State', true) returning id into o_granite;
  insert into public.opponents (name, is_demo) values ('DEMO Pine Ridge University', true) returning id into o_pine;

  for m in
    select * from (values
      -- days ago, type, competition, opponent, series, format, map#, map, our comp, their comp, oT, oCT, tT, tCT, oOT, tOT
      (38, 'scrim',      'Weekly scrims',         o_red,     null,          null,  null, 'Ascent', array['Jett','Sova','Killjoy','Omen','KAY/O'],      array['Raze','Fade','Cypher','Astra','Breach'],  7, 6, 4, 5, 0, 0),
      (36, 'scrim',      'Weekly scrims',         o_lake,    null,          null,  null, 'Bind',   array['Raze','Skye','Cypher','Brimstone','Fade'],   array['Jett','Gekko','Killjoy','Viper','Sova'],  4, 6, 5, 8, 0, 0),
      (33, 'scrim',      'Weekly scrims',         o_pine,    null,          null,  null, 'Lotus',  array['Raze','Fade','Killjoy','Omen','Breach'],     array['Neon','Sova','Vyse','Clove','Gekko'],     6, 6, 6, 6, 0, 0),
      (31, 'official',   'Collegiate League',     o_granite, 'DEMO-CL-W1',  'BO3', 1,    'Ascent', array['Jett','Sova','Killjoy','Omen','KAY/O'],      array['Jett','Sova','Killjoy','Omen','Skye'],    6, 7, 5, 6, 0, 0),
      (31, 'official',   'Collegiate League',     o_granite, 'DEMO-CL-W1',  'BO3', 2,    'Haven',  array['Jett','Breach','Cypher','Omen','Sova'],      array['Iso','Fade','Killjoy','Astra','Breach'],  5, 6, 6, 7, 0, 0),
      (31, 'official',   'Collegiate League',     o_granite, 'DEMO-CL-W1',  'BO3', 3,    'Split',  array['Raze','Skye','Cypher','Omen','Breach'],      array['Jett','Fade','Sage','Viper','Skye'],      5, 7, 5, 7, 2, 0),
      (26, 'scrim',      'Weekly scrims',         o_red,     null,          null,  null, 'Sunset', array['Neon','Fade','Cypher','Omen','Breach'],      array['Raze','Gekko','Killjoy','Clove','Sova'],  3, 4, 4, 9, 0, 0),
      (24, 'scrim',      'Weekly scrims',         o_lake,    null,          null,  null, 'Icebox', array['Jett','Sova','Killjoy','Viper','Gekko'],     array['Reyna','Skye','Sage','Viper','KAY/O'],    7, 7, 5, 5, 0, 0),
      (19, 'tournament', 'DEMO Fall Invitational', o_pine,   'DEMO-FI-R1',  'BO1', 1,    'Ascent', array['Jett','Sova','Killjoy','Omen','KAY/O'],      array['Raze','Fade','Cypher','Astra','Breach'],  8, 5, 1, 4, 0, 0),
      (19, 'tournament', 'DEMO Fall Invitational', o_red,    'DEMO-FI-R2',  'BO1', 1,    'Lotus',  array['Raze','Fade','Killjoy','Omen','Breach'],     array['Raze','Skye','Vyse','Omen','Fade'],       5, 6, 6, 7, 0, 0),
      (12, 'scrim',      'Weekly scrims',         o_granite, null,          null,  null, 'Bind',   array['Raze','Skye','Cypher','Brimstone','Fade'],   array['Neon','Fade','Killjoy','Brimstone','Breach'], 6, 7, 1, 6, 0, 0),
      (9,  'official',   'Collegiate League',     o_lake,    'DEMO-CL-W3',  'BO3', 1,    'Haven',  array['Jett','Breach','Cypher','Omen','Sova'],      array['Jett','Sova','Killjoy','Omen','KAY/O'],   7, 6, 3, 5, 0, 0),
      (9,  'official',   'Collegiate League',     o_lake,    'DEMO-CL-W3',  'BO3', 2,    'Ascent', array['Jett','Sova','Killjoy','Omen','KAY/O'],      array['Raze','Fade','Cypher','Astra','Breach'],  6, 7, 3, 6, 0, 0),
      (4,  'scrim',      'Weekly scrims',         o_pine,    null,          null,  null, 'Abyss',  array['Jett','Sova','Cypher','Astra','KAY/O'],      array['Jett','Fade','Vyse','Omen','Breach'],     5, 6, 6, 7, 0, 0)
    ) as t (days_ago, mtype, competition, opp, series, fmt, map_no, map_name, ours, theirs, o_t, o_ct, t_t, t_ct, o_ot, t_ot)
  loop
    insert into public.matches (played_on, season, competition, match_type, opponent_id, series_id, series_format, map_number,
      map_id, our_agent_ids, opp_agent_ids, our_comp_key, opp_comp_key,
      our_t_rounds, our_ct_rounds, opp_t_rounds, opp_ct_rounds, our_ot_rounds, opp_ot_rounds, is_demo)
    values (current_date - m.days_ago, '', m.competition, m.mtype::public.match_type, m.opp, m.series, m.fmt, m.map_no,
      (select id from public.maps where lower(name) = lower(m.map_name)),
      app.agent_ids(m.ours), app.agent_ids(m.theirs), '', '',
      m.o_t, m.o_ct, m.t_t, m.t_ct, m.o_ot, m.t_ot, true);
  end loop;

  insert into public.team_objectives (title, details, kind, progress, due_on, sort_order, is_demo) values
    ('Win 60% of pistol rounds', 'Example objective. Replace it with your own.', 'objective', 45, current_date + 30, 1, true),
    ('Two approved executes per map in the pool', 'Example objective. Replace it with your own.', 'objective', 30, current_date + 45, 2, true),
    ('Review every official match within 48 hours', 'Example objective. Replace it with your own.', 'objective', 70, null, 3, true),
    ('Fix late rotations on CT side', 'Example staff priority.', 'priority', 0, null, 4, true),
    ('Mid-round calls in post-plant', 'Example staff priority.', 'priority', 0, null, 5, true);

  insert into public.practice_sessions (starts_at, duration_min, session_type, map_id, objective, status, outcome, is_demo) values
    (((current_date + 1) + time '19:00') at time zone 'America/Chicago', 120, 'Strategy practice',
      (select id from public.maps where name = 'Ascent'), 'Rehearse A split and post-plant positions', 'planned', null, true),
    (((current_date + 3) + time '19:00') at time zone 'America/Chicago', 150, 'Scrim block',
      (select id from public.maps where name = 'Lotus'), 'Two scrims, focus on CT retakes', 'planned', null, true),
    (((current_date + 5) + time '18:30') at time zone 'America/Chicago', 90, 'VOD review',
      null, 'Review last official series', 'planned', null, true),
    (((current_date - 2) + time '19:00') at time zone 'America/Chicago', 120, 'Strategy practice',
      (select id from public.maps where name = 'Haven'), 'C site execute timings', 'completed', 'Timings consistent by the end of the session.', true);
end $$;

revoke all on function app.agent_ids(text[]), app.clear_demo_data(), app.load_demo_data() from public;
grant execute on function app.agent_ids(text[]) to authenticated, service_role;
grant execute on function app.clear_demo_data(), app.load_demo_data() to authenticated, service_role;

select app.load_demo_data();

-- >>> 20261124000500_owner_bootstrap.sql
-- =============================================================================
-- First owner without any secret in environment variables:
-- run `select app.create_owner_invitation();` in the Supabase SQL editor and
-- use the code it returns at /join. Works only while the team has no owner.
-- =============================================================================
create or replace function app.create_owner_invitation() returns text
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  raw text := '';
begin
  if auth.uid() is not null then
    raise exception 'Run this from the Supabase SQL editor.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'This team already has an owner. Invite people from Settings → Members.' using errcode = '23514';
  end if;
  for i in 1..12 loop
    raw := raw || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet)), 1);
  end loop;
  -- Only the newest bootstrap code works.
  update public.invitations set revoked_at = now()
  where role = 'owner' and created_by is null and used_at is null and revoked_at is null;
  insert into public.invitations (code_hash, code_hint, role, note, expires_at)
  values (encode(sha256(convert_to(raw, 'UTF8')), 'hex'), right(raw, 4), 'owner', 'First owner', now() + interval '2 days');
  return substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
end $$;

revoke all on function app.create_owner_invitation() from public, anon, authenticated;

-- >>> 20261125000100_development_history.sql
-- =============================================================================
-- Player development history and VOD improvement tasks.
-- Run this in the Supabase SQL editor if your project was set up before it.
-- =============================================================================

-- Every change to a goal's progress or status is kept, so the staff can see how
-- a player evolves week by week.
create table if not exists public.player_goal_progress (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.player_goals (id) on delete cascade,
  progress smallint not null check (progress between 0 and 100),
  status text not null,
  recorded_at timestamptz not null default now()
);
create index if not exists player_goal_progress_goal_idx on public.player_goal_progress (goal_id, recorded_at);
alter table public.player_goal_progress enable row level security;
drop policy if exists goal_progress_read on public.player_goal_progress;
create policy goal_progress_read on public.player_goal_progress for select to authenticated using (app.is_member());
revoke insert, update, delete on public.player_goal_progress from anon, authenticated;
grant select on public.player_goal_progress to authenticated;

create or replace function app.log_goal_progress() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.progress is distinct from old.progress or new.status is distinct from old.status then
    insert into public.player_goal_progress (goal_id, progress, status) values (new.id, new.progress, new.status);
  end if;
  return new;
end $$;
drop trigger if exists player_goals_log on public.player_goals;
create trigger player_goals_log after insert or update on public.player_goals
  for each row execute function app.log_goal_progress();

-- A VOD review can create a feedback task for the player; keep the link.
alter table public.vod_reviews add column if not exists feedback_id uuid references public.feedback (id) on delete set null;

-- >>> 20261126000100_self_service_profiles.sql
-- =============================================================================
-- Self-service profiles
-- Every member changes their own name and photo (profiles already allowed it).
-- A player linked to the roster also edits their own player profile: nickname,
-- photo, agent pool and real name. Roles in the team, activity, order and the
-- staff's assessment (strengths, weaknesses, notes) stay with the staff.
-- Safe to run more than once.
-- =============================================================================

drop policy if exists players_self_update on public.players;
create policy players_self_update on public.players for update to authenticated
  using (app.is_member() and id = app.my_player_id())
  with check (app.is_member() and id = app.my_player_id());

create or replace function app.guard_player_self_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or app.is_staff() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.main_role_id is distinct from old.main_role_id
     or new.secondary_role_id is distinct from old.secondary_role_id
     or new.active is distinct from old.active
     or new.sort_order is distinct from old.sort_order
     or new.is_demo is distinct from old.is_demo
     or new.created_at is distinct from old.created_at then
    raise exception 'Players can change their nickname, photo and agent pool only' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists players_self_guard on public.players;
create trigger players_self_guard before update on public.players
  for each row execute function app.guard_player_self_update();

drop policy if exists player_details_self_insert on public.player_details;
create policy player_details_self_insert on public.player_details for insert to authenticated
  with check (app.is_member() and player_id = app.my_player_id());
drop policy if exists player_details_self_update on public.player_details;
create policy player_details_self_update on public.player_details for update to authenticated
  using (app.is_member() and player_id = app.my_player_id())
  with check (app.is_member() and player_id = app.my_player_id());

create or replace function app.guard_player_details_self() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or app.is_staff() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.strengths is not null or new.weaknesses is not null or new.notes is not null then
      raise exception 'Only the staff writes strengths, weaknesses and notes' using errcode = '42501';
    end if;
  elsif new.player_id is distinct from old.player_id
     or new.strengths is distinct from old.strengths
     or new.weaknesses is distinct from old.weaknesses
     or new.notes is distinct from old.notes then
    raise exception 'Only the staff writes strengths, weaknesses and notes' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists player_details_self_guard on public.player_details;
create trigger player_details_self_guard before insert or update on public.player_details
  for each row execute function app.guard_player_details_self();

-- Photos: any member may upload into their own folder, media/people/<user id>/.
drop policy if exists media_self_insert on storage.objects;
create policy media_self_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and app.is_member()
              and (storage.foldername(name))[1] = 'people'
              and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists media_self_update on storage.objects;
create policy media_self_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'people'
         and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists media_self_delete on storage.objects;
create policy media_self_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'people'
         and (storage.foldername(name))[2] = auth.uid()::text);

-- >>> 20261126000200_tactics_boards.sql
-- =============================================================================
-- Tactics boards: ValoPlant-style drawings on a map (agents, utility, arrows,
-- zones, text). A board belongs to a map and, optionally, to one record:
-- a strategy (Playbook), an opponent (Scouting), a VOD review, a practice
-- session or a match. It is visible wherever that record is visible; boards on
-- matches stay members-only, like match notes. Staff create and edit them.
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  notes text check (char_length(notes) <= 4000),
  map_id uuid references public.maps (id) on delete set null,
  side text check (side in ('attack', 'defense')),
  -- Drawing data (see src/lib/boards/scene.ts). Kept small by the editor.
  scene jsonb not null default '{}'::jsonb check (pg_column_size(scene) < 900000),
  image_url text,
  valoplant_url text check (valoplant_url ~ '^https://([a-z0-9-]+\.)*valoplant\.gg/'),
  section text not null default 'playbook' check (section in ('playbook', 'scouting', 'vod', 'practice', 'matches')),
  strategy_id uuid references public.strategies (id) on delete cascade,
  opponent_id uuid references public.opponents (id) on delete cascade,
  vod_id uuid references public.vod_reviews (id) on delete cascade,
  session_id uuid references public.practice_sessions (id) on delete cascade,
  match_id uuid references public.matches (id) on delete cascade,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boards_one_parent check (num_nonnulls(strategy_id, opponent_id, vod_id, session_id, match_id) <= 1)
);

create index if not exists boards_map_idx on public.boards (map_id);
create index if not exists boards_strategy_idx on public.boards (strategy_id) where strategy_id is not null;
create index if not exists boards_opponent_idx on public.boards (opponent_id) where opponent_id is not null;
create index if not exists boards_vod_idx on public.boards (vod_id) where vod_id is not null;
create index if not exists boards_session_idx on public.boards (session_id) where session_id is not null;
create index if not exists boards_match_idx on public.boards (match_id) where match_id is not null;

-- The section follows the record the board belongs to; a strategy's board takes its map.
create or replace function app.prepare_board() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.section := case
    when new.opponent_id is not null then 'scouting'
    when new.vod_id is not null then 'vod'
    when new.session_id is not null then 'practice'
    when new.match_id is not null then 'matches'
    else 'playbook'
  end;
  if new.strategy_id is not null and new.map_id is null then
    select s.map_id into new.map_id from public.strategies s where s.id = new.strategy_id;
  end if;
  if new.match_id is not null and new.map_id is null then
    select m.map_id into new.map_id from public.matches m where m.id = new.match_id;
  end if;
  if new.vod_id is not null and new.map_id is null then
    select v.map_id into new.map_id from public.vod_reviews v where v.id = new.vod_id;
  end if;
  if new.session_id is not null and new.map_id is null then
    select p.map_id into new.map_id from public.practice_sessions p where p.id = new.session_id;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists boards_prepare on public.boards;
create trigger boards_prepare before insert or update on public.boards
  for each row execute function app.prepare_board();

alter table public.boards enable row level security;
grant select on public.boards to anon;
grant select, insert, update, delete on public.boards to authenticated;

drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards for select to anon, authenticated
  using (app.is_member() or (section <> 'matches' and app.is_public(section)));
drop policy if exists boards_write on public.boards;
create policy boards_write on public.boards for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- >>> 20261126000300_gameplan_and_points.sql
-- =============================================================================
-- Map Playbook as the coach works: per map a gameplan (attack and defense) and
-- how the team reads the map; per strategy its strong and weak points.
-- Earlier map notes (overview, characteristics, important areas, callouts)
-- are carried into "how we read the map" once, so nothing written is lost.
-- Safe to run more than once.
-- =============================================================================

alter table public.map_notes
  add column if not exists gameplan_attack text,
  add column if not exists gameplan_defense text,
  add column if not exists map_reading text;

update public.map_notes
set map_reading = concat_ws(E'\n\n',
  overview,
  characteristics,
  case when important_areas is not null then 'Important areas:' || E'\n' || important_areas end,
  case when callouts is not null then 'Callouts:' || E'\n' || callouts end)
where map_reading is null
  and coalesce(overview, characteristics, important_areas, callouts) is not null;

alter table public.strategies
  add column if not exists strong_points text,
  add column if not exists weak_points text;

-- >>> Record the migrations above as applied, so the app only runs newer ones.
create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now());
insert into app.schema_migrations (name) values
  ('20261124000100_core_schema'),
  ('20261124000200_security'),
  ('20261124000300_seed_catalog'),
  ('20261124000400_demo_data'),
  ('20261124000500_owner_bootstrap'),
  ('20261125000100_development_history'),
  ('20261126000100_self_service_profiles'),
  ('20261126000200_tactics_boards'),
  ('20261126000300_gameplan_and_points')
on conflict (name) do nothing;

-- >>> First owner: the result of this line is a one-time invitation code.
-- Open <your site>/join, enter it with your email and a password, and you are the owner.
select app.create_owner_invitation() as owner_invitation_code;
