import "server-only";
import type { Catalog } from "@/lib/data/catalog";
import type { Strategy } from "@/lib/data/playbook";
import type { StrategyInitial } from "./forms";

export function strategyFormOptions(catalog: Catalog, strategy?: Strategy | null) {
  const used = new Set([...(strategy?.comp_agent_ids ?? []), ...(strategy?.assignments ?? []).map((a) => a.agent_id ?? "")]);
  return {
    maps: catalog.maps.filter((m) => m.active || m.id === strategy?.map_id).map((m) => ({ id: m.id, name: m.name })),
    agents: catalog.agents.filter((a) => a.active || used.has(a.id)).map(({ id, name, role }) => ({ id, name, role })),
    players: catalog.players.filter((p) => p.active).map(({ id, nickname }) => ({ id, nickname })),
  };
}

export function toInitial(s: Strategy): StrategyInitial {
  const t = (v: string | null) => v ?? "";
  return {
    id: s.id,
    map_id: s.map_id,
    side: s.side,
    category: s.category,
    name: s.name,
    status: s.status,
    description: t(s.description),
    objective: t(s.objective),
    comp_agent_ids: s.comp_agent_ids,
    assignments: Array.isArray(s.assignments) ? s.assignments : [],
    starting_positions: t(s.starting_positions),
    utility_usage: t(s.utility_usage),
    timing: t(s.timing),
    callouts: t(s.callouts),
    execution: t(s.execution),
    strong_points: t(s.strong_points),
    weak_points: t(s.weak_points),
    youtube_url: t(s.youtube_url),
  };
}
