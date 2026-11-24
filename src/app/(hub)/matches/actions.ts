"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actorOf } from "@/lib/auth/viewer";
import { DENIED, int, num, staffOrNull, text } from "@/lib/auth/guards";
import { friendlyDbError, withActor } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { validateRounds } from "@/lib/stats/rounds";

const uuid = z.string().uuid();

function agentList(fd: FormData, prefix: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => String(fd.get(`${prefix}${i}`) ?? "")).filter(Boolean);
}

function optionalCount(fd: FormData, name: string, max = 60): number | null {
  const v = int(fd.get(name));
  return v === null ? null : Math.max(0, Math.min(max, v));
}

export async function saveMatch(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const fields: Record<string, string> = {};

  const id = text(fd.get("id"));
  if (id && !uuid.safeParse(id).success) return { error: "That match no longer exists.", fields };

  const playedOn = String(fd.get("played_on") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) fields.played_on = "Pick the date.";
  const type = String(fd.get("match_type") ?? "");
  if (!["scrim", "official", "tournament"].includes(type)) fields.match_type = "Pick the match type.";
  const opponentName = text(fd.get("opponent"));
  if (!opponentName || opponentName.length < 2) fields.opponent = "Enter the opponent.";
  const mapId = String(fd.get("map_id") ?? "");
  if (!uuid.safeParse(mapId).success) fields.map_id = "Pick the map.";

  const ours = agentList(fd, "our_agent_");
  const theirs = agentList(fd, "opp_agent_");
  if (ours.length !== 5 || new Set(ours).size !== 5) fields.our_agents = "Pick five different agents for your team.";
  if (theirs.length !== 5 || new Set(theirs).size !== 5) fields.opp_agents = "Pick five different agents for the opponent.";

  const rounds = {
    type: type as "scrim" | "official" | "tournament",
    ourT: int(fd.get("our_t_rounds")) ?? -1,
    ourCT: int(fd.get("our_ct_rounds")) ?? -1,
    oppT: int(fd.get("opp_t_rounds")) ?? -1,
    oppCT: int(fd.get("opp_ct_rounds")) ?? -1,
    ourOT: type === "scrim" ? 0 : (int(fd.get("our_ot_rounds")) ?? 0),
    oppOT: type === "scrim" ? 0 : (int(fd.get("opp_ot_rounds")) ?? 0),
  };
  const roundsError = fields.match_type ? null : validateRounds(rounds);
  if (roundsError) fields.rounds = roundsError;

  const seriesId = text(fd.get("series_id"))?.slice(0, 60) ?? null;
  const seriesFormat = text(fd.get("series_format"));
  if (seriesFormat && !["BO1", "BO3", "BO5"].includes(seriesFormat)) fields.series_format = "Pick BO1, BO3 or BO5.";
  const mapNumber = int(fd.get("map_number"));
  if (mapNumber !== null && (mapNumber < 1 || mapNumber > 5)) fields.map_number = "Map number goes from 1 to 5.";
  if (seriesFormat && !seriesId) fields.series_id = "Give the series an id so its maps can be grouped.";
  if (seriesFormat && mapNumber && mapNumber > Number(seriesFormat.slice(2))) fields.map_number = `A ${seriesFormat} has at most ${seriesFormat.slice(2)} maps.`;

  const vodUrl = text(fd.get("vod_url"));
  if (vodUrl && !/^https?:\/\//.test(vodUrl)) fields.vod_url = "Use a full link starting with https://";

  const metrics = {
    pistols_won: optionalCount(fd, "pistols_won", 2),
    anti_eco_won: optionalCount(fd, "anti_eco_won"),
    anti_eco_played: optionalCount(fd, "anti_eco_played"),
    bonus_won: optionalCount(fd, "bonus_won"),
    bonus_played: optionalCount(fd, "bonus_played"),
    first_bloods: optionalCount(fd, "first_bloods"),
    first_blood_wins: optionalCount(fd, "first_blood_wins"),
  };
  if (metrics.anti_eco_won !== null && metrics.anti_eco_played !== null && metrics.anti_eco_won > metrics.anti_eco_played)
    fields.metrics = "Anti-eco rounds won can't be more than anti-eco rounds played.";
  if (metrics.bonus_won !== null && metrics.bonus_played !== null && metrics.bonus_won > metrics.bonus_played)
    fields.metrics = "Bonus rounds won can't be more than bonus rounds played.";
  if (metrics.first_bloods !== null && metrics.first_blood_wins !== null && metrics.first_blood_wins > metrics.first_bloods)
    fields.metrics = "Rounds won after first blood can't be more than first bloods.";

  // Player scoreboard rows (only rows marked as played)
  const playerIds = fd.getAll("ps_player").map(String).filter((p) => uuid.safeParse(p).success);
  const stats = playerIds
    .filter((pid) => fd.get(`ps_played_${pid}`) === "on")
    .map((pid) => ({
      player_id: pid,
      agent_id: uuid.safeParse(fd.get(`ps_agent_${pid}`)).success ? String(fd.get(`ps_agent_${pid}`)) : null,
      kills: int(fd.get(`ps_k_${pid}`)),
      deaths: int(fd.get(`ps_d_${pid}`)),
      assists: int(fd.get(`ps_a_${pid}`)),
      acs: int(fd.get(`ps_acs_${pid}`)),
      adr: num(fd.get(`ps_adr_${pid}`)),
      hs_pct: num(fd.get(`ps_hs_${pid}`)),
      first_kills: int(fd.get(`ps_fk_${pid}`)),
      first_deaths: int(fd.get(`ps_fd_${pid}`)),
    }));
  if (stats.length > 5) fields.stats = "Mark at most five players as played.";
  if (stats.some((s) => [s.kills, s.deaths, s.assists, s.acs, s.adr, s.first_kills, s.first_deaths].some((v) => v !== null && v < 0)))
    fields.stats = "Scoreboard numbers can't be negative.";
  if (stats.some((s) => s.hs_pct !== null && (s.hs_pct < 0 || s.hs_pct > 100))) fields.stats = "Headshot % goes from 0 to 100.";

  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };

  let savedId = id;
  try {
    savedId = await withActor(actorOf(me), async (tx) => {
      // Reuse an existing opponent with the same name (any capitalisation) to avoid duplicates.
      const [existing] = await tx<{ id: string }[]>`select id from public.opponents where lower(name) = lower(${opponentName!})`;
      const opponentId =
        existing?.id ?? (await tx<{ id: string }[]>`insert into public.opponents (name) values (${opponentName!}) returning id`)[0]!.id;

      const row = {
        played_on: playedOn,
        competition: text(fd.get("competition"))?.slice(0, 80) ?? null,
        match_type: type,
        opponent_id: opponentId,
        series_id: seriesId,
        series_format: seriesFormat,
        map_number: mapNumber,
        map_id: mapId,
        our_agent_ids: ours,
        opp_agent_ids: theirs,
        our_t_rounds: rounds.ourT,
        our_ct_rounds: rounds.ourCT,
        opp_t_rounds: rounds.oppT,
        opp_ct_rounds: rounds.oppCT,
        our_ot_rounds: rounds.ourOT,
        opp_ot_rounds: rounds.oppOT,
        ...metrics,
      };

      let matchId: string;
      if (id) {
        const updated = await tx<{ id: string }[]>`update public.matches set ${tx(row)} where id = ${id} returning id`;
        if (!updated[0]) throw new Error("not-found");
        matchId = updated[0].id;
      } else {
        matchId = (
          await tx<{ id: string }[]>`insert into public.matches ${tx({ ...row, season: "", our_comp_key: "", opp_comp_key: "", created_by: me.userId })} returning id`
        )[0]!.id;
      }

      const notes = text(fd.get("notes"));
      await tx`insert into public.match_notes (match_id, notes, vod_url) values (${matchId}, ${notes}, ${vodUrl})
               on conflict (match_id) do update set notes = excluded.notes, vod_url = excluded.vod_url`;
      const coach = text(fd.get("coach_notes"));
      await tx`insert into public.match_coach_notes (match_id, notes) values (${matchId}, ${coach})
               on conflict (match_id) do update set notes = excluded.notes`;

      await tx`delete from public.match_player_stats where match_id = ${matchId}`;
      for (const s of stats) {
        await tx`insert into public.match_player_stats ${tx({ match_id: matchId, ...s })}`;
      }
      return matchId;
    });
  } catch (e) {
    if ((e as Error).message === "not-found") return { error: "That match no longer exists.", fields: {} };
    return { error: friendlyDbError(e), fields: {} };
  }

  revalidatePath("/", "layout");
  redirect(`/matches/${savedId}?saved=1`);
}

export async function deleteMatch(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "That match no longer exists.", fields: {} };
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.matches where id = ${id.data}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  redirect("/matches?deleted=1");
}
