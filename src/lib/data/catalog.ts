import "server-only";
import type { Tx } from "../db";
import { agentImages, mapImages } from "./valorant-api";

export type Agent = { id: string; name: string; role: string; active: boolean; image: string | null; image_url: string | null };
export type MapRow = {
  id: string;
  name: string;
  in_rotation: boolean;
  active: boolean;
  image_url: string | null;
  image: string | null;
  splash: string | null;
};
export type PlayerLite = {
  id: string;
  nickname: string;
  photo_url: string | null;
  main_role_id: string | null;
  active: boolean;
};
export type Opponent = { id: string; name: string; short_name: string | null; logo_url: string | null; is_demo: boolean };
export type Role = { id: string; name: string };

/** Agents, maps, players, roles and opponents the viewer may see, with images resolved. */
export async function loadCatalog(tx: Tx) {
  const [agents, maps, players, roles, opponents, pics, mapPics] = await Promise.all([
    tx<Omit<Agent, "image">[]>`select id, name, role, active, image_url from public.agents order by sort_order, name`,
    tx<Omit<MapRow, "image" | "splash">[]>`select id, name, in_rotation, active, image_url from public.maps order by sort_order, name`,
    tx<PlayerLite[]>`select id, nickname, photo_url, main_role_id, active from public.players order by sort_order, nickname`,
    tx<Role[]>`select id, name from public.team_roles order by sort_order, name`,
    tx<Opponent[]>`select id, name, short_name, logo_url, is_demo from public.opponents order by lower(name)`,
    agentImages(),
    mapImages(),
  ]);
  const agentList: Agent[] = agents.map((a) => ({ ...a, image: a.image_url ?? pics[a.name.toLowerCase()] ?? null }));
  const mapList: MapRow[] = maps.map((m) => ({
    ...m,
    image: m.image_url ?? mapPics.wide[m.name.toLowerCase()] ?? null,
    splash: m.image_url ?? mapPics.splash[m.name.toLowerCase()] ?? null,
  }));
  return {
    agents: agentList,
    maps: mapList,
    players,
    roles,
    opponents,
    agentById: new Map(agentList.map((a) => [a.id, a])),
    mapById: new Map(mapList.map((m) => [m.id, m])),
    playerById: new Map(players.map((p) => [p.id, p])),
    roleById: new Map(roles.map((r) => [r.id, r])),
    opponentById: new Map(opponents.map((o) => [o.id, o])),
  };
}

export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

/** Agents of a composition, ordered by role then name so lineups read the same everywhere. */
export function compAgents(catalog: Catalog, ids: string[]) {
  const order = ["duelist", "initiator", "controller", "sentinel"];
  return ids
    .map((id) => catalog.agentById.get(id))
    .filter((a): a is Agent => Boolean(a))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name));
}
