import "server-only";
import { withActor } from "../db";
import { actorOf, type Viewer } from "../auth/viewer";
import type { MatchRow } from "../stats/matches";
import { agentImages, mapImages } from "./valorant-api";

export type AgentInfo = { id: string; name: string; role: string; image: string | null };
export type MapInfo = { id: string; name: string; in_rotation: boolean; image: string | null };

export type Objective = {
  id: string;
  title: string;
  kind: "objective" | "priority";
  progress: number;
  due_on: string | null;
  is_demo: boolean;
};
export type UpcomingSession = {
  id: string;
  starts_at: string;
  duration_min: number;
  session_type: string;
  objective: string | null;
  map_id: string | null;
  is_demo: boolean;
};
export type FeedbackItem = {
  id: string;
  given_on: string;
  category: string;
  status: string;
  areas_to_improve: string | null;
  player_nickname: string;
  is_demo: boolean;
};

export const MATCH_COLUMNS = `id, played_on, created_at::text as created_at, season, competition, match_type, opponent_id,
  series_id, series_format, map_number, map_id, our_agent_ids, opp_agent_ids, our_comp_key, opp_comp_key,
  our_t_rounds, our_ct_rounds, opp_t_rounds, opp_ct_rounds, our_ot_rounds, opp_ot_rounds,
  our_score, opp_score, round_diff, result, is_demo,
  pistols_won, anti_eco_won, anti_eco_played, bonus_won, bonus_played, first_bloods, first_blood_wins`;

/** Everything the Overview needs, read with the viewer's own permissions. */
export async function loadOverview(viewer: Viewer) {
  const [rows, agentPics, mapPics] = await Promise.all([
    withActor(actorOf(viewer), async (tx) => {
      const matches = await tx.unsafe<MatchRow[]>(`select ${MATCH_COLUMNS} from public.matches order by played_on desc`);
      const agents = await tx<{ id: string; name: string; role: string; image_url: string | null }[]>`
        select id, name, role, image_url from public.agents order by sort_order, name`;
      const maps = await tx<{ id: string; name: string; in_rotation: boolean; image_url: string | null }[]>`
        select id, name, in_rotation, image_url from public.maps order by sort_order, name`;
      const opponents = await tx<{ id: string; name: string; is_demo: boolean }[]>`
        select id, name, is_demo from public.opponents`;
      // The three queries below return only what the viewer may see (RLS).
      const objectives = await tx<Objective[]>`
        select id, title, kind, progress, due_on, is_demo from public.team_objectives
        where status = 'active' order by kind, sort_order, created_at limit 8`;
      const sessions = await tx<UpcomingSession[]>`
        select id, starts_at::text as starts_at, duration_min, session_type, objective, map_id, is_demo
        from public.practice_sessions where status = 'planned' and starts_at >= now() - interval '2 hours'
        order by starts_at limit 4`;
      const feedback = await tx<FeedbackItem[]>`
        select f.id, f.given_on, f.category, f.status, f.areas_to_improve, p.nickname as player_nickname, f.is_demo
        from public.feedback f join public.players p on p.id = f.player_id
        order by f.given_on desc, f.created_at desc limit 4`;
      const practiceVisible = (await tx<{ ok: boolean }[]>`select app.can_view('{practice}') as ok`)[0]!.ok;
      return { matches, agents, maps, opponents, objectives, sessions, feedback, practiceVisible };
    }),
    agentImages(),
    mapImages(),
  ]);

  const agents: AgentInfo[] = rows.agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    image: a.image_url ?? agentPics[a.name.toLowerCase()] ?? null,
  }));
  const maps: MapInfo[] = rows.maps.map((m) => ({
    id: m.id,
    name: m.name,
    in_rotation: m.in_rotation,
    image: m.image_url ?? mapPics.wide[m.name.toLowerCase()] ?? null,
  }));

  return {
    ...rows,
    agents,
    maps,
    agentById: new Map(agents.map((a) => [a.id, a])),
    mapById: new Map(maps.map((m) => [m.id, m])),
    opponentById: new Map(rows.opponents.map((o) => [o.id, o])),
  };
}

export type OverviewData = Awaited<ReturnType<typeof loadOverview>>;
