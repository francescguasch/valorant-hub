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
