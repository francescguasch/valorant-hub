import "server-only";
import type { Tx } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";

export async function sessionOptions(tx: Tx) {
  const catalog = await loadCatalog(tx);
  const strategies = await tx<{ id: string; name: string; map_id: string; side: string }[]>`
    select id, name, map_id, side::text as side from public.strategies where archived_at is null order by name`;
  return {
    catalog,
    maps: catalog.maps.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name })),
    strategies,
    players: catalog.players.filter((p) => p.active).map((p) => ({ id: p.id, nickname: p.nickname })),
  };
}
