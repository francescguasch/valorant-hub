import "server-only";
import type { Tx } from "../db";
import type { PlayerGame } from "../stats/player";

export type PlayerFull = {
  id: string;
  nickname: string;
  photo_url: string | null;
  main_role_id: string | null;
  secondary_role_id: string | null;
  main_agent_ids: string[];
  secondary_agent_ids: string[];
  active: boolean;
  is_demo: boolean;
  real_name: string | null;
  strengths: string | null;
  weaknesses: string | null;
  notes: string | null;
};

const PLAYER_SELECT = `select p.id, p.nickname, p.photo_url, p.main_role_id, p.secondary_role_id, p.main_agent_ids,
  p.secondary_agent_ids, p.active, p.is_demo, coalesce(d.real_name, rn.real_name) as real_name, d.strengths,
  d.weaknesses, d.notes
  from public.players p left join public.player_details d on d.player_id = p.id
  left join app.public_real_names() rn on rn.player_id = p.id`;

/**
 * Player details (strengths, notes…) come back empty for visitors: RLS hides them. The real name reaches visitors
 * only when the owner allows it (Settings → Visitor access).
 */
export async function listPlayers(tx: Tx): Promise<PlayerFull[]> {
  return tx.unsafe<PlayerFull[]>(`${PLAYER_SELECT} order by p.active desc, p.sort_order, p.nickname`);
}

export async function getPlayer(tx: Tx, id: string): Promise<PlayerFull | null> {
  const rows = await tx.unsafe<PlayerFull[]>(`${PLAYER_SELECT} where p.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Every map the player has a scoreboard line in, newest first. */
export async function playerGames(tx: Tx, playerId: string): Promise<PlayerGame[]> {
  const rows = await tx<PlayerGame[]>`
    select m.id as match_id, m.played_on::text as played_on, m.match_type::text as match_type, m.map_id, m.opponent_id,
           m.result, m.our_score, m.opp_score, s.agent_id, s.kills, s.deaths, s.assists, s.acs,
           s.adr::float8 as adr, s.hs_pct::float8 as hs_pct, s.first_kills, s.first_deaths
    from public.match_player_stats s join public.matches m on m.id = s.match_id
    where s.player_id = ${playerId}
    order by m.played_on desc, m.created_at desc`;
  return rows;
}
