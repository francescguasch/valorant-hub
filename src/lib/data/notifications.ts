import "server-only";
import { cache } from "react";
import { withActor } from "../db";
import { actorOf, isStaff, type Viewer } from "../auth/viewer";

export type Notice = {
  key: string;
  title: string;
  detail: string;
  href: string;
  tone: "info" | "due";
};

/**
 * What needs this person's attention, worked out from the data (nothing to
 * mark as read). Staff: follow-ups due, sessions without results, open VOD
 * items. Players: new feedback, goals close to their deadline, sessions soon.
 */
export const getNotifications = cache(async (viewer: Viewer): Promise<Notice[]> => {
  if (viewer.kind !== "member") return [];
  const staff = isStaff(viewer);
  return withActor(actorOf(viewer), async (tx) => {
    const out: Notice[] = [];
    const soon = await tx<{ id: string; session_type: string; hours: number; attending_player_ids: string[] }[]>`
      select id, session_type, ceil(extract(epoch from starts_at - now()) / 3600)::int as hours, attending_player_ids
      from public.practice_sessions
      where status = 'planned' and starts_at between now() and now() + interval '48 hours' order by starts_at`;
    for (const s of soon) {
      if (!staff && viewer.playerId && !s.attending_player_ids.includes(viewer.playerId)) continue;
      out.push({
        key: `s${s.id}`,
        title: `${s.session_type} starts soon`,
        detail: s.hours <= 1 ? "Starts within the hour." : `Starts in about ${s.hours} hours.`,
        href: `/practice/${s.id}`,
        tone: "info",
      });
    }
    if (staff) {
      const followUps = await tx<{ id: string; player: string; category: string }[]>`
        select f.id, p.nickname as player, f.category from public.feedback f join public.players p on p.id = f.player_id
        where f.status <> 'resolved' and f.follow_up_on is not null and f.follow_up_on <= current_date + 2
        order by f.follow_up_on limit 10`;
      for (const f of followUps)
        out.push({
          key: `f${f.id}`,
          title: `Follow up with ${f.player}`,
          detail: `${f.category} feedback is due for review.`,
          href: `/development/feedback/${f.id}/edit`,
          tone: "due",
        });
      const unfinished = await tx<{ id: string; session_type: string }[]>`
        select id, session_type from public.practice_sessions
        where status = 'planned' and starts_at + make_interval(mins => duration_min) < now() - interval '2 hours'
        order by starts_at desc limit 5`;
      for (const s of unfinished)
        out.push({
          key: `u${s.id}`,
          title: `Add results: ${s.session_type}`,
          detail: "This session has passed but isn't marked completed.",
          href: `/practice/${s.id}/edit`,
          tone: "due",
        });
      const [vod] = await tx<
        { n: number }[]
      >`select count(*)::int as n from public.vod_reviews where status = 'open' and created_at < now() - interval '7 days'`;
      if (vod && vod.n > 0)
        out.push({
          key: "vod",
          title: `${vod.n} VOD item${vod.n === 1 ? "" : "s"} open for over a week`,
          detail: "Close them or turn them into improvement tasks.",
          href: "/vod?status=open",
          tone: "due",
        });
    } else if (viewer.playerId) {
      const fresh = await tx<{ id: string; category: string }[]>`
        select id, category from public.feedback where player_id = ${viewer.playerId} and created_at > now() - interval '14 days'
        order by created_at desc limit 5`;
      for (const f of fresh)
        out.push({
          key: `f${f.id}`,
          title: "New feedback for you",
          detail: f.category,
          href: "/development",
          tone: "info",
        });
      const goals = await tx<{ id: string; description: string }[]>`
        select id, description from public.player_goals where player_id = ${viewer.playerId}
        and status in ('not_started', 'in_progress') and deadline between current_date and current_date + 7`;
      for (const g of goals)
        out.push({
          key: `g${g.id}`,
          title: "Goal deadline this week",
          detail: g.description,
          href: "/development?tab=goals",
          tone: "due",
        });
    }
    return out;
  });
});
