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
