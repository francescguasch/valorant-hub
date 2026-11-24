-- =============================================================================
-- Starting catalogue: roles, agents, maps and the Dakota roster.
-- Everything here is editable from Settings. Nothing is marked as "in
-- rotation": the staff chooses the active competitive pool in Settings.
-- =============================================================================

insert into public.team_roles (name, sort_order) values
  ('Sentinel', 1), ('Initiator', 2), ('Main Entry', 3), ('Second Entry', 4), ('Controller / Smoker', 5);

insert into public.maps (name, sort_order) values
  ('Abyss', 1), ('Ascent', 2), ('Bind', 3), ('Breeze', 4), ('Corrode', 5), ('Fracture', 6), ('Haven', 7),
  ('Icebox', 8), ('Lotus', 9), ('Pearl', 10), ('Split', 11), ('Summit', 12), ('Sunset', 13);

insert into public.agents (name, role, sort_order) values
  ('Astra', 'controller', 1), ('Breach', 'initiator', 2), ('Brimstone', 'controller', 3), ('Chamber', 'sentinel', 4),
  ('Clove', 'controller', 5), ('Cypher', 'sentinel', 6), ('Deadlock', 'sentinel', 7), ('Fade', 'initiator', 8),
  ('Gekko', 'initiator', 9), ('Harbor', 'controller', 10), ('Iso', 'duelist', 11), ('Jett', 'duelist', 12),
  ('KAY/O', 'initiator', 13), ('Killjoy', 'sentinel', 14), ('Neon', 'duelist', 15), ('Omen', 'controller', 16),
  ('Phoenix', 'duelist', 17), ('Raze', 'duelist', 18), ('Reyna', 'duelist', 19), ('Sage', 'sentinel', 20),
  ('Skye', 'initiator', 21), ('Sova', 'initiator', 22), ('Tejo', 'initiator', 23), ('Veto', 'sentinel', 24),
  ('Viper', 'controller', 25), ('Vyse', 'sentinel', 26), ('Waylay', 'duelist', 27), ('Yoru', 'duelist', 28);

-- Roster supplied by the team. Only nickname and main role are known; the rest is left empty on purpose.
insert into public.players (nickname, main_role_id, sort_order)
select v.nickname, r.id, v.sort_order
from (values ('Zach', 'Sentinel', 1), ('JaxaPixel', 'Initiator', 2), ('Stryker', 'Main Entry', 3),
             ('DoubleB', 'Second Entry', 4), ('Justin', 'Controller / Smoker', 5)) as v (nickname, role_name, sort_order)
join public.team_roles r on r.name = v.role_name;

insert into public.player_details (player_id) select id from public.players;
