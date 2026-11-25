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
