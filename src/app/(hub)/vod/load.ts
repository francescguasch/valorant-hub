import "server-only";
import type { Tx } from "@/lib/db";
import { developmentOptions } from "../development/options";

export async function vodOptions(tx: Tx) {
  const o = await developmentOptions(tx);
  return {
    catalog: o.catalog,
    matches: o.matches,
    players: o.players,
    maps: o.catalog.maps.filter((m) => m.active).map((m) => ({ value: m.id, label: m.name })),
  };
}

export type VodRow = {
  id: string;
  match_id: string | null;
  map_id: string | null;
  round_number: number | null;
  video_timestamp: string | null;
  clip_url: string | null;
  player_id: string | null;
  category: string | null;
  what_happened: string;
  should_have_happened: string | null;
  improvement_action: string | null;
  assigned_player_id: string | null;
  status: string;
  feedback_id: string | null;
  is_demo: boolean;
  created_on: string;
  recent: boolean;
};

export const VOD_SELECT = `select id, match_id, map_id, round_number, video_timestamp, clip_url, player_id, category, what_happened,
  should_have_happened, improvement_action, assigned_player_id, status, feedback_id, is_demo,
  (created_at at time zone 'UTC')::date::text as created_on, created_at > now() - interval '30 days' as recent
  from public.vod_reviews`;

/** "12:34" or "1:02:03" → seconds. */
export function toSeconds(ts: string | null): number {
  if (!ts) return 0;
  return ts.split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0);
}
