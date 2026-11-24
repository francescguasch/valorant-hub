import "server-only";
import type { Tx } from "../db";

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
  p.secondary_agent_ids, p.active, p.is_demo, d.real_name, d.strengths, d.weaknesses, d.notes
  from public.players p left join public.player_details d on d.player_id = p.id`;

/** Player details (real name, strengths…) come back empty for visitors: RLS hides them. */
export async function listPlayers(tx: Tx): Promise<PlayerFull[]> {
  return tx.unsafe<PlayerFull[]>(`${PLAYER_SELECT} order by p.active desc, p.sort_order, p.nickname`);
}

export async function getPlayer(tx: Tx, id: string): Promise<PlayerFull | null> {
  const rows = await tx.unsafe<PlayerFull[]>(`${PLAYER_SELECT} where p.id = $1`, [id]);
  return rows[0] ?? null;
}

export type AgentLine = { agent_id: string | null; maps: number; kills: number; deaths: number; acs: number | null; wins: number };

export async function statsByAgent(tx: Tx, playerId: string): Promise<AgentLine[]> {
  return tx<AgentLine[]>`
    select s.agent_id, count(*)::int as maps, coalesce(sum(s.kills), 0)::int as kills, coalesce(sum(s.deaths), 0)::int as deaths,
           round(avg(s.acs))::int as acs, count(*) filter (where m.result = 'W')::int as wins
    from public.match_player_stats s join public.matches m on m.id = s.match_id
    where s.player_id = ${playerId}
    group by s.agent_id order by count(*) desc`;
}

export type RecentLine = {
  match_id: string;
  played_on: string;
  map_id: string;
  opponent_id: string;
  result: "W" | "L" | "D";
  our_score: number;
  opp_score: number;
  agent_id: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  acs: number | null;
};

export async function recentPlayerMatches(tx: Tx, playerId: string, limit = 8): Promise<RecentLine[]> {
  return tx<RecentLine[]>`
    select m.id as match_id, m.played_on, m.map_id, m.opponent_id, m.result, m.our_score, m.opp_score,
           s.agent_id, s.kills, s.deaths, s.assists, s.acs
    from public.match_player_stats s join public.matches m on m.id = s.match_id
    where s.player_id = ${playerId}
    order by m.played_on desc, m.created_at desc limit ${limit}`;
}

export type Goal = {
  id: string;
  player_id: string;
  description: string;
  current_level: string | null;
  target: string | null;
  deadline: string | null;
  progress: number;
  status: string;
  comments: string | null;
  is_demo: boolean;
  updated_at: string;
};

export async function listGoals(tx: Tx, playerId?: string): Promise<Goal[]> {
  return tx<Goal[]>`
    select id, player_id, description, current_level, target, deadline, progress, status, comments, is_demo, updated_at::text as updated_at
    from public.player_goals where (${playerId ?? null}::uuid is null or player_id = ${playerId ?? null}::uuid)
    order by (status in ('achieved', 'missed')), deadline nulls last, created_at`;
}

export type GoalPoint = { goal_id: string; progress: number; recorded_on: string };

export async function goalHistory(tx: Tx, goalIds: string[]): Promise<GoalPoint[]> {
  if (goalIds.length === 0) return [];
  return tx<GoalPoint[]>`
    select goal_id, progress, (recorded_at at time zone 'UTC')::date::text as recorded_on
    from public.player_goal_progress where goal_id = any (${goalIds}::uuid[]) order by recorded_at`;
}

export type Feedback = {
  id: string;
  player_id: string;
  given_on: string;
  match_id: string | null;
  practice_session_id: string | null;
  category: string;
  strengths: string | null;
  areas_to_improve: string | null;
  specific_example: string | null;
  evidence: string | null;
  vod_clip_url: string | null;
  improvement_action: string | null;
  follow_up_on: string | null;
  status: string;
  is_demo: boolean;
};

/** RLS returns only what the viewer may read: staff see all, a player sees their own. */
export async function listFeedback(tx: Tx, f: { player?: string; category?: string; status?: string } = {}): Promise<Feedback[]> {
  return tx<Feedback[]>`
    select id, player_id, given_on, match_id, practice_session_id, category, strengths, areas_to_improve, specific_example,
           evidence, vod_clip_url, improvement_action, follow_up_on, status, is_demo
    from public.feedback
    where (${f.player ?? null}::uuid is null or player_id = ${f.player ?? null}::uuid)
      and (${f.category ?? null}::text is null or category = ${f.category ?? null}::text)
      and (${f.status ?? null}::text is null or status = ${f.status ?? null}::text)
    order by given_on desc, created_at desc`;
}
