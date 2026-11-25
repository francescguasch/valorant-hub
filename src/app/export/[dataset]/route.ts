import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { actorOf, getViewer } from "@/lib/auth/viewer";
import { withActor, type Tx } from "@/lib/db";
import { listMatches, parseFilters } from "@/lib/data/matches";
import { loadCatalog } from "@/lib/data/catalog";

/**
 * CSV / Excel exports. Members only. Every query runs with the person's own
 * permissions, so a player's export contains only what that player can see.
 */
type Table = { name: string; columns: string[]; rows: (string | number | boolean | null)[][] };

async function matchesTable(tx: Tx, sp: URLSearchParams): Promise<Table> {
  const catalog = await loadCatalog(tx);
  const rows = await listMatches(tx, parseFilters(Object.fromEntries(sp)));
  const agentNames = (ids: string[]) => ids.map((id) => catalog.agentById.get(id)?.name ?? "?").sort().join(" + ");
  return {
    name: "Matches",
    columns: [
      "Date", "Season", "Type", "Competition", "Opponent", "Series", "Format", "Map #", "Map", "Our composition",
      "Opponent composition", "Our T", "Our CT", "Our OT", "Opp T", "Opp CT", "Opp OT", "Our score", "Opp score",
      "Round diff", "Result", "Demo",
    ],
    rows: rows.map((m) => [
      m.played_on, m.season, m.match_type, m.competition, catalog.opponentById.get(m.opponent_id)?.name ?? "", m.series_id,
      m.series_format, m.map_number, catalog.mapById.get(m.map_id)?.name ?? "", agentNames(m.our_agent_ids), agentNames(m.opp_agent_ids),
      m.our_t_rounds, m.our_ct_rounds, m.our_ot_rounds, m.opp_t_rounds, m.opp_ct_rounds, m.opp_ot_rounds, m.our_score, m.opp_score,
      m.round_diff, m.result, m.is_demo,
    ]),
  };
}

async function query(tx: Tx, name: string, sql: string): Promise<Table> {
  const rows = await tx.unsafe<Record<string, unknown>[]>(sql);
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return {
    name,
    columns,
    rows: rows.map((r) => columns.map((c) => {
      const v = r[c];
      if (v === null || v === undefined) return null;
      if (Array.isArray(v)) return v.join(", ");
      if (v instanceof Date) return v.toISOString();
      return typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean);
    })),
  };
}

const DATASETS: Record<string, (tx: Tx, sp: URLSearchParams) => Promise<Table>> = {
  matches: matchesTable,
  "player-stats": (tx) =>
    query(tx, "Player stats", `
      select m.played_on as date, p.nickname as player, a.name as agent, mp.name as map, o.name as opponent,
             s.kills, s.deaths, s.assists, s.acs, s.adr, s.hs_pct, s.first_kills, s.first_deaths, m.result
      from public.match_player_stats s
      join public.matches m on m.id = s.match_id
      join public.players p on p.id = s.player_id
      left join public.agents a on a.id = s.agent_id
      join public.maps mp on mp.id = m.map_id
      join public.opponents o on o.id = m.opponent_id
      order by m.played_on desc, p.nickname`),
  opponents: (tx) =>
    query(tx, "Opponents", `
      select o.name, o.short_name,
             count(m.*) as matches, count(*) filter (where m.result = 'W') as wins, count(*) filter (where m.result = 'L') as losses,
             coalesce(sum(m.round_diff), 0) as round_diff, max(m.played_on) as last_match, n.notes as scouting_notes
      from public.opponents o
      left join public.matches m on m.opponent_id = o.id
      left join public.opponent_notes n on n.opponent_id = o.id
      group by o.id, n.notes order by o.name`),
  strategies: (tx) =>
    query(tx, "Strategies", `
      select mp.name as map, s.side, s.category, s.name, s.status, s.objective, s.description, s.starting_positions,
             s.utility_usage, s.timing, s.callouts, s.execution, s.alternatives, s.common_mistakes, s.coaching_notes,
             s.youtube_url, s.archived_at is not null as archived, s.updated_at::date as updated
      from public.strategies s join public.maps mp on mp.id = s.map_id order by mp.name, s.side, s.category, s.name`),
  practice: (tx) =>
    query(tx, "Practice", `
      select s.starts_at, s.duration_min, s.session_type, mp.name as map, st.name as strategy, s.objective, s.status,
             (select string_agg(p.nickname, ', ') from public.players p where p.id = any (s.attending_player_ids)) as attending,
             s.outcome, s.coach_notes, s.next_steps
      from public.practice_sessions s
      left join public.maps mp on mp.id = s.map_id left join public.strategies st on st.id = s.strategy_id
      order by s.starts_at desc`),
  vod: (tx) =>
    query(tx, "VOD reviews", `
      select v.created_at::date as date, mp.name as map, v.round_number, v.video_timestamp, p.nickname as player, v.category,
             v.what_happened, v.should_have_happened, v.improvement_action, ap.nickname as assigned_to, v.status, v.clip_url
      from public.vod_reviews v left join public.maps mp on mp.id = v.map_id
      left join public.players p on p.id = v.player_id left join public.players ap on ap.id = v.assigned_player_id
      order by v.created_at desc`),
};

function csvCell(v: string | number | boolean | null): string {
  if (v === null) return "";
  let s = String(v);
  // Keep spreadsheet apps from treating text as a formula.
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  const viewer = await getViewer();
  if (viewer.kind !== "member") return NextResponse.json({ error: "Sign in to export data." }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const names = dataset === "all" ? Object.keys(DATASETS) : DATASETS[dataset] ? [dataset] : [];
  if (names.length === 0) return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  if (format === "csv" && names.length > 1) return NextResponse.json({ error: "CSV exports one table at a time." }, { status: 400 });

  const tables = await withActor(actorOf(viewer), async (tx) => {
    const out: Table[] = [];
    for (const n of names) out.push(await DATASETS[n]!(tx, sp));
    return out;
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `team-hub-${dataset}-${stamp}`;

  if (format === "csv") {
    const t = tables[0]!;
    const body = "﻿" + [t.columns, ...t.rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    return new NextResponse(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${base}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "VALORANT Team Hub";
  for (const t of tables) {
    const ws = wb.addWorksheet(t.name.slice(0, 31));
    ws.addRow(t.columns).font = { bold: true };
    t.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 16));
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${base}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
