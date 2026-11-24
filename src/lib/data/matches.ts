import "server-only";
import type { Tx } from "../db";
import type { MatchRow } from "../stats/matches";
import { MATCH_COLUMNS } from "./overview";

export type MatchFilters = {
  season?: string;
  type?: string;
  map?: string;
  opponent?: string;
  competition?: string;
  from?: string;
  to?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/;

/** Reads filters from search params, ignoring anything malformed. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): MatchFilters {
  const one = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const f: MatchFilters = {};
  const season = one("season");
  if (season && /^\d{4}\/\d{4}$/.test(season)) f.season = season;
  const type = one("type");
  if (type && ["scrim", "official", "tournament"].includes(type)) f.type = type;
  const map = one("map");
  if (map && UUID.test(map)) f.map = map;
  const opponent = one("opponent");
  if (opponent && UUID.test(opponent)) f.opponent = opponent;
  const competition = one("competition");
  if (competition) f.competition = competition.slice(0, 80);
  const from = one("from");
  if (from && DATE.test(from)) f.from = from;
  const to = one("to");
  if (to && DATE.test(to)) f.to = to;
  return f;
}

export function hasFilters(f: MatchFilters) {
  return Object.values(f).some(Boolean);
}

export async function listMatches(tx: Tx, f: MatchFilters = {}): Promise<MatchRow[]> {
  return tx.unsafe<MatchRow[]>(
    `select ${MATCH_COLUMNS} from public.matches
     where ($1::text is null or season = $1)
       and ($2::text is null or match_type::text = $2)
       and ($3::uuid is null or map_id = $3)
       and ($4::uuid is null or opponent_id = $4)
       and ($5::text is null or competition = $5)
       and ($6::date is null or played_on >= $6)
       and ($7::date is null or played_on <= $7)
     order by played_on desc, coalesce(map_number, 0) desc, created_at desc`,
    [f.season ?? null, f.type ?? null, f.map ?? null, f.opponent ?? null, f.competition ?? null, f.from ?? null, f.to ?? null],
  );
}

export type MatchDetail = MatchRow & {
  pistols_won: number | null;
  anti_eco_won: number | null;
  anti_eco_played: number | null;
  bonus_won: number | null;
  bonus_played: number | null;
  first_bloods: number | null;
  first_blood_wins: number | null;
};

export type PlayerStatRow = {
  match_id: string;
  player_id: string;
  agent_id: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  acs: number | null;
  adr: string | null;
  hs_pct: string | null;
  first_kills: number | null;
  first_deaths: number | null;
};

export async function getMatch(tx: Tx, id: string) {
  const [match] = await tx.unsafe<MatchDetail[]>(
    `select ${MATCH_COLUMNS} from public.matches where id = $1`,
    [id],
  );
  if (!match) return null;
  const [notes] = await tx<{ notes: string | null; vod_url: string | null }[]>`
    select notes, vod_url from public.match_notes where match_id = ${id}`;
  const [coach] = await tx<{ notes: string | null }[]>`select notes from public.match_coach_notes where match_id = ${id}`;
  const stats = await tx<PlayerStatRow[]>`
    select match_id, player_id, agent_id, kills, deaths, assists, acs, adr::text, hs_pct::text, first_kills, first_deaths
    from public.match_player_stats where match_id = ${id}`;
  const series = match.series_id
    ? await tx.unsafe<MatchRow[]>(`select ${MATCH_COLUMNS} from public.matches where series_id = $1 order by map_number nulls last, created_at`, [
        match.series_id,
      ])
    : [];
  return { match, notes: notes ?? null, coachNotes: coach?.notes ?? null, stats, series };
}

export async function seasonsAndCompetitions(tx: Tx) {
  const seasons = (await tx<{ season: string }[]>`select distinct season from public.matches order by season desc`).map((r) => r.season);
  const competitions = (
    await tx<{ competition: string }[]>`select distinct competition from public.matches where competition is not null order by competition`
  ).map((r) => r.competition);
  return { seasons, competitions };
}

export type PlayerAggregate = {
  player_id: string;
  maps: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number | null;
  adr: number | null;
  hs_pct: number | null;
  first_kills: number;
  first_deaths: number;
  wins: number;
};

/** Scoreboard totals per player over the matches that pass the filters. */
export async function playerAggregates(tx: Tx, f: MatchFilters = {}, playerId?: string): Promise<PlayerAggregate[]> {
  return tx.unsafe<PlayerAggregate[]>(
    `select s.player_id, count(*)::int as maps,
            coalesce(sum(s.kills), 0)::int as kills, coalesce(sum(s.deaths), 0)::int as deaths, coalesce(sum(s.assists), 0)::int as assists,
            round(avg(s.acs))::int as acs, round(avg(s.adr), 1)::float as adr, round(avg(s.hs_pct), 1)::float as hs_pct,
            coalesce(sum(s.first_kills), 0)::int as first_kills, coalesce(sum(s.first_deaths), 0)::int as first_deaths,
            count(*) filter (where m.result = 'W')::int as wins
     from public.match_player_stats s join public.matches m on m.id = s.match_id
     where ($1::text is null or m.season = $1)
       and ($2::text is null or m.match_type::text = $2)
       and ($3::uuid is null or m.map_id = $3)
       and ($4::uuid is null or m.opponent_id = $4)
       and ($5::text is null or m.competition = $5)
       and ($6::date is null or m.played_on >= $6)
       and ($7::date is null or m.played_on <= $7)
       and ($8::uuid is null or s.player_id = $8)
     group by s.player_id order by avg(s.acs) desc nulls last`,
    [f.season ?? null, f.type ?? null, f.map ?? null, f.opponent ?? null, f.competition ?? null, f.from ?? null, f.to ?? null, playerId ?? null],
  );
}
