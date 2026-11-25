import "server-only";
import type { Tx } from "../db";
import { boardAssets } from "./valorant-api";
import { calloutLabel, parseScene, SIZE, type BoardCatalog, type Scene } from "../boards/scene";

export type BoardSection = "playbook" | "scouting" | "vod" | "practice" | "matches";
export type BoardParent =
  | { kind: "strategy"; id: string }
  | { kind: "opponent"; id: string }
  | { kind: "vod"; id: string }
  | { kind: "session"; id: string }
  | { kind: "match"; id: string };

export const PARENT_COLUMN = {
  strategy: "strategy_id",
  opponent: "opponent_id",
  vod: "vod_id",
  session: "session_id",
  match: "match_id",
} as const;

export const SECTION_LABEL: Record<BoardSection, string> = {
  playbook: "Map Playbook",
  scouting: "Opponent Scouting",
  vod: "VOD Review",
  practice: "Practice Planner",
  matches: "Match Center",
};

export type BoardCard = {
  id: string;
  title: string;
  map_id: string | null;
  scene: Scene;
  image_url: string | null;
  map_name: string | null;
  side: "attack" | "defense" | null;
  section: BoardSection;
  created_at: string;
  updated_at: string;
};

export type BoardRow = BoardCard & {
  notes: string | null;
  valoplant_url: string | null;
  scene: Scene;
  strategy_id: string | null;
  opponent_id: string | null;
  vod_id: string | null;
  session_id: string | null;
  match_id: string | null;
  created_by_name: string | null;
  parent: { label: string; href: string; kind: string } | null;
};

/** Maps (with minimap and callouts) and agents (with abilities) for the editor. */
export async function boardCatalog(tx: Tx): Promise<BoardCatalog> {
  const [maps, agents, assets] = await Promise.all([
    tx<
      { id: string; name: string }[]
    >`select id, name from public.maps where active order by in_rotation desc, sort_order, name`,
    tx<{ name: string; role: string; image_url: string | null }[]>`
      select name, role::text as role, image_url from public.agents where active order by name`,
    boardAssets(),
  ]);
  return {
    maps: maps.map((m) => {
      const a = assets.maps[m.name.toLowerCase()];
      return {
        id: m.id,
        name: m.name,
        minimap: a?.minimap ?? null,
        // The minimap is drawn 40 units narrower than the board (20 each side).
        scale: a?.perMetre ? Math.round(a.perMetre * (SIZE - 40) * 1000) / 1000 : null,
        callouts: (a?.callouts ?? []).map((c) => ({
          label: calloutLabel(c.superRegion, c.region),
          x: Math.round(c.x * SIZE),
          y: Math.round(c.y * SIZE),
        })),
      };
    }),
    agents: agents.map((g) => {
      const a = assets.agents[g.name.toLowerCase()];
      return { name: g.name, role: g.role, icon: g.image_url ?? a?.icon ?? null, abilities: a?.abilities ?? [] };
    }),
  };
}

const CARD_COLUMNS = (tx: Tx) => tx`
  b.id, b.title, b.map_id, b.scene, b.image_url, mp.name as map_name, b.side, b.section,
  b.created_at::text as created_at, b.updated_at::text as updated_at`;

/** Boards attached to one record, or the boards of a map that belong to no record. */
export async function listBoards(tx: Tx, where: BoardParent | { kind: "map"; id: string } | { kind: "all" }) {
  const filter =
    where.kind === "all"
      ? tx``
      : where.kind === "map"
        ? tx`where b.map_id = ${where.id} and num_nonnulls(b.strategy_id, b.opponent_id, b.vod_id, b.session_id, b.match_id) = 0`
        : tx`where ${tx(PARENT_COLUMN[where.kind])} = ${where.id}`;
  const rows = await tx<(Omit<BoardCard, "scene"> & { scene: unknown })[]>`
    select ${CARD_COLUMNS(tx)}
    from public.boards b left join public.maps mp on mp.id = b.map_id
    ${filter}
    order by b.updated_at desc`;
  return rows.map((r) => ({ ...r, scene: parseScene(r.scene) }));
}

/** Each strategy's own board (its first) on one map, for the strategy cards. */
export async function strategyBoards(tx: Tx, mapId: string) {
  const rows = await tx<(Omit<BoardCard, "scene"> & { scene: unknown; strategy_id: string })[]>`
    select distinct on (b.strategy_id) ${CARD_COLUMNS(tx)}, b.strategy_id
    from public.boards b left join public.maps mp on mp.id = b.map_id
    join public.strategies s on s.id = b.strategy_id
    where s.map_id = ${mapId}
    order by b.strategy_id, b.created_at`;
  const byStrategy = new Map(rows.map((r) => [r.strategy_id, { ...r, scene: parseScene(r.scene) } as BoardCard]));
  return { byStrategy, catalog: rows.length ? await boardCatalog(tx) : null };
}

/** Boards plus what's needed to draw them (only fetched when there are boards). */
export async function boardsFor(tx: Tx, where: Parameters<typeof listBoards>[1]) {
  const boards = await listBoards(tx, where);
  return { boards, catalog: boards.length ? await boardCatalog(tx) : null };
}

export async function getBoard(tx: Tx, id: string): Promise<BoardRow | null> {
  const [row] = await tx<(Omit<BoardRow, "scene" | "parent"> & { scene: unknown; parent_label: string | null })[]>`
    select ${CARD_COLUMNS(tx)}, b.notes, b.valoplant_url,
           b.strategy_id, b.opponent_id, b.vod_id, b.session_id, b.match_id,
           pr.display_name as created_by_name,
           coalesce(s.name, o.name, v.category, ps.session_type, mo.name) as parent_label
    from public.boards b
    left join public.maps mp on mp.id = b.map_id
    left join public.profiles pr on pr.id = b.created_by
    left join public.strategies s on s.id = b.strategy_id
    left join public.opponents o on o.id = b.opponent_id
    left join public.vod_reviews v on v.id = b.vod_id
    left join public.practice_sessions ps on ps.id = b.session_id
    left join public.matches m on m.id = b.match_id
    left join public.opponents mo on mo.id = m.opponent_id
    where b.id = ${id}`;
  if (!row) return null;
  const { parent_label, ...rest } = row;
  return { ...rest, scene: parseScene(row.scene), parent: parentOf(row, parent_label) };
}

function parentOf(
  b: Pick<BoardRow, "strategy_id" | "opponent_id" | "vod_id" | "session_id" | "match_id" | "map_id">,
  label: string | null,
): BoardRow["parent"] {
  if (b.strategy_id)
    return { kind: "Strategy", label: label ?? "Strategy", href: `/playbook/strategy/${b.strategy_id}` };
  if (b.opponent_id) return { kind: "Opponent", label: label ?? "Opponent", href: `/scouting/${b.opponent_id}` };
  if (b.vod_id) return { kind: "VOD review", label: label ?? "VOD review", href: `/vod/${b.vod_id}` };
  if (b.session_id) return { kind: "Practice", label: label ?? "Practice session", href: `/practice/${b.session_id}` };
  if (b.match_id) return { kind: "Match", label: label ? `vs ${label}` : "Match", href: `/matches/${b.match_id}` };
  return null;
}

/** Where "back" goes after saving or cancelling a board for this record. */
export function parentHref(parent: BoardParent | null, mapId: string | null): string {
  if (!parent) return mapId ? `/playbook/${mapId}` : "/boards";
  switch (parent.kind) {
    case "strategy":
      return `/playbook/strategy/${parent.id}`;
    case "opponent":
      return `/scouting/${parent.id}`;
    case "vod":
      return `/vod/${parent.id}`;
    case "session":
      return `/practice/${parent.id}`;
    case "match":
      return `/matches/${parent.id}`;
  }
}
