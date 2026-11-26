-- =============================================================================
-- For a plain Postgres database (e.g. Neon) instead of Supabase: recreates the
-- few Supabase pieces the migrations rely on (API roles, auth.uid(), a storage
-- stub). The app runs this by itself before the first migration when the
-- database has no `auth` schema; a Supabase project always has one, so it never
-- runs there. Without Supabase Auth nobody can sign in: such a deployment is a
-- read-only showcase (TEAM_PRESET=showcase).
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit; end if;
  execute format('grant anon, authenticated, service_role to %I', current_user);
end $$;

create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth, extensions, storage, public to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text unique,
  created_at timestamptz default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket_id text references storage.buckets (id), name text, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
