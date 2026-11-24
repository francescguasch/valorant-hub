-- =============================================================================
-- DEMO data: fictional opponents, matches, objectives and practice sessions so
-- the platform can be tried before real data exists. Every row is flagged
-- is_demo = true and shown with a DEMO badge. Remove it all from
-- Settings → Data, or run:  select app.clear_demo_data();
-- No demo data is attached to real players (no invented stats or feedback).
-- =============================================================================

create or replace function app.agent_ids(names text[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select array_agg(a.id order by n.ord)
  from unnest(names) with ordinality as n (name, ord)
  join public.agents a on lower(a.name) = lower(n.name)
$$;

create or replace function app.clear_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not app.is_owner() then
    raise exception 'Only the team owner can remove demo data' using errcode = '42501';
  end if;
  delete from public.vod_reviews where is_demo;
  delete from public.feedback where is_demo;
  delete from public.player_goals where is_demo;
  delete from public.practice_sessions where is_demo;
  delete from public.team_objectives where is_demo;
  delete from public.strategies where is_demo;
  delete from public.matches where is_demo;
  delete from public.opponents o where o.is_demo
    and not exists (select 1 from public.matches m where m.opponent_id = o.id);
  delete from public.players where is_demo;
end $$;

create or replace function app.load_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  o_red uuid; o_lake uuid; o_granite uuid; o_pine uuid;
  m record;
begin
  if auth.uid() is not null and not app.is_owner() then
    raise exception 'Only the team owner can load demo data' using errcode = '42501';
  end if;
  perform app.clear_demo_data();

  insert into public.opponents (name, is_demo) values ('DEMO Red Valley College', true) returning id into o_red;
  insert into public.opponents (name, is_demo) values ('DEMO Lakeside Tech', true) returning id into o_lake;
  insert into public.opponents (name, is_demo) values ('DEMO Granite State', true) returning id into o_granite;
  insert into public.opponents (name, is_demo) values ('DEMO Pine Ridge University', true) returning id into o_pine;

  for m in
    select * from (values
      -- days ago, type, competition, opponent, series, format, map#, map, our comp, their comp, oT, oCT, tT, tCT, oOT, tOT
      (38, 'scrim',      'Weekly scrims',         o_red,     null,          null,  null, 'Ascent', array['Jett','Sova','Killjoy','Omen','KAY/O'],      array['Raze','Fade','Cypher','Astra','Breach'],  7, 6, 4, 5, 0, 0),
      (36, 'scrim',      'Weekly scrims',         o_lake,    null,          null,  null, 'Bind',   array['Raze','Skye','Cypher','Brimstone','Fade'],   array['Jett','Gekko','Killjoy','Viper','Sova'],  4, 6, 5, 8, 0, 0),
      (33, 'scrim',      'Weekly scrims',         o_pine,    null,          null,  null, 'Lotus',  array['Raze','Fade','Killjoy','Omen','Breach'],     array['Neon','Sova','Vyse','Clove','Gekko'],     6, 6, 6, 6, 0, 0),
      (31, 'official',   'Collegiate League',     o_granite, 'DEMO-CL-W1',  'BO3', 1,    'Ascent', array['Jett','Sova','Killjoy','Omen','KAY/O'],      array['Jett','Sova','Killjoy','Omen','Skye'],    6, 7, 5, 6, 0, 0),
      (31, 'official',   'Collegiate League',     o_granite, 'DEMO-CL-W1',  'BO3', 2,    'Haven',  array['Jett','Breach','Cypher','Omen','Sova'],      array['Iso','Fade','Killjoy','Astra','Breach'],  5, 6, 6, 7, 0, 0),
      (31, 'official',   'Collegiate League',     o_granite, 'DEMO-CL-W1',  'BO3', 3,    'Split',  array['Raze','Skye','Cypher','Omen','Breach'],      array['Jett','Fade','Sage','Viper','Skye'],      5, 7, 5, 7, 2, 0),
      (26, 'scrim',      'Weekly scrims',         o_red,     null,          null,  null, 'Sunset', array['Neon','Fade','Cypher','Omen','Breach'],      array['Raze','Gekko','Killjoy','Clove','Sova'],  3, 4, 4, 9, 0, 0),
      (24, 'scrim',      'Weekly scrims',         o_lake,    null,          null,  null, 'Icebox', array['Jett','Sova','Killjoy','Viper','Gekko'],     array['Reyna','Skye','Sage','Viper','KAY/O'],    7, 7, 5, 5, 0, 0),
      (19, 'tournament', 'DEMO Fall Invitational', o_pine,   'DEMO-FI-R1',  'BO1', 1,    'Ascent', array['Jett','Sova','Killjoy','Omen','KAY/O'],      array['Raze','Fade','Cypher','Astra','Breach'],  8, 5, 1, 4, 0, 0),
      (19, 'tournament', 'DEMO Fall Invitational', o_red,    'DEMO-FI-R2',  'BO1', 1,    'Lotus',  array['Raze','Fade','Killjoy','Omen','Breach'],     array['Raze','Skye','Vyse','Omen','Fade'],       5, 6, 6, 7, 0, 0),
      (12, 'scrim',      'Weekly scrims',         o_granite, null,          null,  null, 'Bind',   array['Raze','Skye','Cypher','Brimstone','Fade'],   array['Neon','Fade','Killjoy','Brimstone','Breach'], 6, 7, 1, 6, 0, 0),
      (9,  'official',   'Collegiate League',     o_lake,    'DEMO-CL-W3',  'BO3', 1,    'Haven',  array['Jett','Breach','Cypher','Omen','Sova'],      array['Jett','Sova','Killjoy','Omen','KAY/O'],   7, 6, 3, 5, 0, 0),
      (9,  'official',   'Collegiate League',     o_lake,    'DEMO-CL-W3',  'BO3', 2,    'Ascent', array['Jett','Sova','Killjoy','Omen','KAY/O'],      array['Raze','Fade','Cypher','Astra','Breach'],  6, 7, 3, 6, 0, 0),
      (4,  'scrim',      'Weekly scrims',         o_pine,    null,          null,  null, 'Abyss',  array['Jett','Sova','Cypher','Astra','KAY/O'],      array['Jett','Fade','Vyse','Omen','Breach'],     5, 6, 6, 7, 0, 0)
    ) as t (days_ago, mtype, competition, opp, series, fmt, map_no, map_name, ours, theirs, o_t, o_ct, t_t, t_ct, o_ot, t_ot)
  loop
    insert into public.matches (played_on, season, competition, match_type, opponent_id, series_id, series_format, map_number,
      map_id, our_agent_ids, opp_agent_ids, our_comp_key, opp_comp_key,
      our_t_rounds, our_ct_rounds, opp_t_rounds, opp_ct_rounds, our_ot_rounds, opp_ot_rounds, is_demo)
    values (current_date - m.days_ago, '', m.competition, m.mtype::public.match_type, m.opp, m.series, m.fmt, m.map_no,
      (select id from public.maps where lower(name) = lower(m.map_name)),
      app.agent_ids(m.ours), app.agent_ids(m.theirs), '', '',
      m.o_t, m.o_ct, m.t_t, m.t_ct, m.o_ot, m.t_ot, true);
  end loop;

  insert into public.team_objectives (title, details, kind, progress, due_on, sort_order, is_demo) values
    ('Win 60% of pistol rounds', 'Example objective. Replace it with your own.', 'objective', 45, current_date + 30, 1, true),
    ('Two approved executes per map in the pool', 'Example objective. Replace it with your own.', 'objective', 30, current_date + 45, 2, true),
    ('Review every official match within 48 hours', 'Example objective. Replace it with your own.', 'objective', 70, null, 3, true),
    ('Fix late rotations on CT side', 'Example staff priority.', 'priority', 0, null, 4, true),
    ('Mid-round calls in post-plant', 'Example staff priority.', 'priority', 0, null, 5, true);

  insert into public.practice_sessions (starts_at, duration_min, session_type, map_id, objective, status, outcome, is_demo) values
    (((current_date + 1) + time '19:00') at time zone 'America/Chicago', 120, 'Strategy practice',
      (select id from public.maps where name = 'Ascent'), 'Rehearse A split and post-plant positions', 'planned', null, true),
    (((current_date + 3) + time '19:00') at time zone 'America/Chicago', 150, 'Scrim block',
      (select id from public.maps where name = 'Lotus'), 'Two scrims, focus on CT retakes', 'planned', null, true),
    (((current_date + 5) + time '18:30') at time zone 'America/Chicago', 90, 'VOD review',
      null, 'Review last official series', 'planned', null, true),
    (((current_date - 2) + time '19:00') at time zone 'America/Chicago', 120, 'Strategy practice',
      (select id from public.maps where name = 'Haven'), 'C site execute timings', 'completed', 'Timings consistent by the end of the session.', true);
end $$;

revoke all on function app.agent_ids(text[]), app.clear_demo_data(), app.load_demo_data() from public;
grant execute on function app.agent_ids(text[]) to authenticated, service_role;
grant execute on function app.clear_demo_data(), app.load_demo_data() to authenticated, service_role;

select app.load_demo_data();
