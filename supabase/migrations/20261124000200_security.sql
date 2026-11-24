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
