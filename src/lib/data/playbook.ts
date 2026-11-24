import "server-only";
import type { Tx } from "../db";

export type Assignment = { player_id: string | null; agent_id: string | null; task: string | null };

export type Strategy = {
  id: string;
  map_id: string;
  side: "t" | "ct";
  category: string;
  name: string;
  description: string | null;
  objective: string | null;
  comp_agent_ids: string[];
  assignments: Assignment[];
  starting_positions: string | null;
  utility_usage: string | null;
  timing: string | null;
  callouts: string | null;
  execution: string | null;
  alternatives: string | null;
  common_mistakes: string | null;
  coaching_notes: string | null;
  youtube_url: string | null;
  status: "in_development" | "practicing" | "approved";
  archived_at: string | null;
  is_demo: boolean;
  updated_at: string;
};

export type MapNotes = {
  overview: string | null;
  characteristics: string | null;
  important_areas: string | null;
  callouts: string | null;
  strengths: string | null;
  weaknesses: string | null;
  recommended_comps: string | null;
  callouts_image_url: string | null;
};

const STRATEGY_COLUMNS = `id, map_id, side, category, name, description, objective, comp_agent_ids, assignments,
  starting_positions, utility_usage, timing, callouts, execution, alternatives, common_mistakes, coaching_notes,
  youtube_url, status, archived_at::text as archived_at, is_demo, updated_at::text as updated_at`;

/** jsonb arrives parsed; guard against legacy rows stored as a JSON string. */
function normalize(s: Strategy): Strategy {
  let a: unknown = s.assignments;
  if (typeof a === "string") {
    try {
      a = JSON.parse(a);
    } catch {
      a = [];
    }
  }
  return { ...s, assignments: Array.isArray(a) ? (a as Assignment[]) : [] };
}

export async function strategiesForMap(tx: Tx, mapId: string): Promise<Strategy[]> {
  const rows = await tx.unsafe<Strategy[]>(`select ${STRATEGY_COLUMNS} from public.strategies where map_id = $1 order by side, category, name`, [mapId]);
  return rows.map(normalize);
}

export async function getStrategy(tx: Tx, id: string): Promise<Strategy | null> {
  const rows = await tx.unsafe<Strategy[]>(`select ${STRATEGY_COLUMNS} from public.strategies where id = $1`, [id]);
  return rows[0] ? normalize(rows[0]) : null;
}

export async function strategyCounts(tx: Tx) {
  return tx<{ map_id: string; total: number; approved: number }[]>`
    select map_id, count(*)::int as total, count(*) filter (where status = 'approved')::int as approved
    from public.strategies where archived_at is null group by map_id`;
}

export async function getMapNotes(tx: Tx, mapId: string): Promise<MapNotes | null> {
  const rows = await tx<MapNotes[]>`
    select overview, characteristics, important_areas, callouts, strengths, weaknesses, recommended_comps, callouts_image_url
    from public.map_notes where map_id = ${mapId}`;
  return rows[0] ?? null;
}
