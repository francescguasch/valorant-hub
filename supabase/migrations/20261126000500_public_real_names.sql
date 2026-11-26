-- Real names on the roster.
-- Members always see them. Visitors only when the owner turns it on in Settings → Visitor access.
alter table public.team_settings add column if not exists show_real_names boolean not null default false;

create or replace function app.public_real_names()
returns table (player_id uuid, real_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.player_id, d.real_name
  from public.player_details d
  where nullif(trim(d.real_name), '') is not null
    and coalesce((select s.show_real_names from public.team_settings s where s.id), false)
$$;

revoke all on function app.public_real_names() from public;
grant execute on function app.public_real_names() to anon, authenticated, service_role;
