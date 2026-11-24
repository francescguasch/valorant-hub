import "server-only";
import type { Tx } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { getMatch } from "@/lib/data/matches";
import type { MatchInitial } from "./match-form";

export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Everything the match form needs, plus the starting values (blank or from an existing match). */
export async function loadMatchForm(tx: Tx, timeZone: string, matchId?: string) {
  const catalog = await loadCatalog(tx);
  const existing = matchId ? await getMatch(tx, matchId) : null;
  const seriesIds = (
    await tx<{ series_id: string }[]>`select series_id from public.matches where series_id is not null
                                       group by series_id order by max(played_on) desc limit 30`
  ).map((r) => r.series_id);
  const competitions = (
    await tx<{ competition: string }[]>`select distinct competition from public.matches where competition is not null order by competition`
  ).map((r) => r.competition);

  const usedAgents = new Set(existing ? [...existing.match.our_agent_ids, ...existing.match.opp_agent_ids] : []);
  const agents = catalog.agents.filter((a) => a.active || usedAgents.has(a.id)).map(({ id, name, role }) => ({ id, name, role }));
  const maps = catalog.maps
    .filter((m) => m.active || m.id === existing?.match.map_id)
    .map(({ id, name, in_rotation }) => ({ id, name, in_rotation }));
  const statPlayers = new Set(existing?.stats.map((s) => s.player_id) ?? []);
  const players = catalog.players.filter((p) => p.active || statPlayers.has(p.id)).map(({ id, nickname }) => ({ id, nickname }));

  const s = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const m = existing?.match;
  const initial: MatchInitial = {
    id: m?.id,
    played_on: m?.played_on ?? todayIn(timeZone),
    match_type: m?.match_type ?? "scrim",
    competition: m?.competition ?? "",
    opponent: m ? (catalog.opponentById.get(m.opponent_id)?.name ?? "") : "",
    series_id: m?.series_id ?? "",
    series_format: m?.series_format ?? "",
    map_number: s(m?.map_number),
    map_id: m?.map_id ?? "",
    our_agent_ids: m?.our_agent_ids ?? [],
    opp_agent_ids: m?.opp_agent_ids ?? [],
    our_t_rounds: s(m?.our_t_rounds),
    our_ct_rounds: s(m?.our_ct_rounds),
    opp_t_rounds: s(m?.opp_t_rounds),
    opp_ct_rounds: s(m?.opp_ct_rounds),
    our_ot_rounds: m?.our_ot_rounds ? String(m.our_ot_rounds) : "",
    opp_ot_rounds: m?.opp_ot_rounds ? String(m.opp_ot_rounds) : "",
    pistols_won: s(m?.pistols_won),
    anti_eco_won: s(m?.anti_eco_won),
    anti_eco_played: s(m?.anti_eco_played),
    bonus_won: s(m?.bonus_won),
    bonus_played: s(m?.bonus_played),
    first_bloods: s(m?.first_bloods),
    first_blood_wins: s(m?.first_blood_wins),
    notes: existing?.notes?.notes ?? "",
    coach_notes: existing?.coachNotes ?? "",
    vod_url: existing?.notes?.vod_url ?? "",
    stats: Object.fromEntries((existing?.stats ?? []).map((st) => [st.player_id, st])),
  };

  return {
    found: !matchId || Boolean(existing),
    initial,
    agents,
    maps,
    players,
    opponents: catalog.opponents.map((o) => o.name),
    competitions,
    seriesIds,
  };
}
