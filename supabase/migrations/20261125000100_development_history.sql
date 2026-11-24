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
