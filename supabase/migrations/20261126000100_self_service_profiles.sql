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
