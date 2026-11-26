-- A team photo for the top of the Roster page (optional). Safe to run more than once.
alter table public.team_settings add column if not exists roster_image_url text;
