import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { boardCatalog, parentHref, type BoardParent } from "@/lib/data/boards";
import { emptyScene } from "@/lib/boards/scene";
import { BoardEditor } from "@/components/boards/board-editor";

export const metadata: Metadata = { title: "New tactics board" };

const uuid = z.string().uuid();
const KINDS = ["strategy", "opponent", "vod", "session", "match"] as const;

export default async function NewBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(viewer.kind === "member" ? "/boards" : "/login?next=%2Fboards");
  const sp = await searchParams;
  const kind = KINDS.find((k) => uuid.safeParse(sp[k]).success);
  const parent: BoardParent | null = kind ? { kind, id: sp[kind]! } : null;
  const requestedMap = uuid.safeParse(sp.map).success ? sp.map! : null;

  const data = await withActor(actorOf(viewer), async (tx) => {
    const catalog = await boardCatalog(tx);
    let label: string | null = null;
    let mapId = requestedMap;
    let side: "attack" | "defense" | null = null;
    if (parent?.kind === "strategy") {
      const [s] = await tx<{ name: string; map_id: string; side: string }[]>`
        select name, map_id, side::text as side from public.strategies where id = ${parent.id}`;
      if (s) {
        label = s.name;
        mapId ??= s.map_id;
        side = s.side === "t" ? "attack" : s.side === "ct" ? "defense" : null;
      }
    } else if (parent?.kind === "opponent") {
      label =
        (await tx<{ name: string }[]>`select name from public.opponents where id = ${parent.id}`)[0]?.name ?? null;
    } else if (parent?.kind === "vod") {
      const [v] = await tx<{ category: string | null; map_id: string | null }[]>`
        select category, map_id from public.vod_reviews where id = ${parent.id}`;
      if (v) {
        label = v.category ? `VOD: ${v.category}` : "VOD review";
        mapId ??= v.map_id;
      }
    } else if (parent?.kind === "session") {
      const [p] = await tx<{ session_type: string; map_id: string | null }[]>`
        select session_type, map_id from public.practice_sessions where id = ${parent.id}`;
      if (p) {
        label = p.session_type;
        mapId ??= p.map_id;
      }
    } else if (parent?.kind === "match") {
      const [m] = await tx<{ opponent: string | null; map_id: string }[]>`
        select o.name as opponent, m.map_id from public.matches m left join public.opponents o on o.id = m.opponent_id
        where m.id = ${parent.id}`;
      if (m) {
        label = m.opponent ? `Match vs ${m.opponent}` : "Match";
        mapId ??= m.map_id;
      }
    }
    if (parent && !label) return null; // the record is gone or not visible
    if (!parent && mapId) label = catalog.maps.find((m) => m.id === mapId)?.name ?? null;
    return { catalog, label, mapId, side };
  });
  if (!data) redirect("/boards");

  return (
    <BoardEditor
      catalog={data.catalog}
      initial={{
        id: null,
        title: "",
        notes: "",
        map_id: data.mapId,
        side: data.side,
        valoplant_url: "",
        scene: emptyScene(),
      }}
      parent={parent}
      parentLabel={data.label ?? "Tactics boards"}
      backHref={parentHref(parent, parent ? null : data.mapId)}
    />
  );
}
