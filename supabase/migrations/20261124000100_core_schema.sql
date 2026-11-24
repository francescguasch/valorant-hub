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
