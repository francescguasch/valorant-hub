/**
 * Database security tests. They run the real migrations' policies through the
 * same `withActor` helper the app uses, against a disposable Postgres that has
 * Supabase's roles (see README → Tests). Skipped when TEST_DATABASE_URL is unset.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const { asSystem, withActor, db } = await import("../src/lib/db");

const ids = {
  owner: "00000000-0000-4000-8000-0000000000a1",
  coach: "00000000-0000-4000-8000-0000000000a2",
  zach: "00000000-0000-4000-8000-0000000000a3",
  stryker: "00000000-0000-4000-8000-0000000000a4",
  blocked: "00000000-0000-4000-8000-0000000000a5",
};
const as = (id: string) => ({ userId: id });
let zachPlayer = "";
let strykerPlayer = "";
let originalSections: string[] = [];

async function rejects(p: Promise<unknown>, code?: string) {
  try {
    await p;
  } catch (e) {
    if (code) expect((e as { code?: string }).code).toBe(code);
    return;
  }
  throw new Error("expected the database to reject this");
}

async function cleanup() {
  await asSystem(async (tx) => {
    // Test-only: skip the "last owner" guard so the throwaway accounts can go.
    await tx`set local session_replication_role = replica`;
    await tx`delete from public.feedback where areas_to_improve like 'SECTEST%'`;
    await tx`delete from public.matches where competition = 'SECTEST'`;
    await tx`delete from public.invitations where note = 'SECTEST'`;
    await tx`delete from public.profiles where email like '%@sec.test'`;
    await tx`delete from auth.users where email like '%@sec.test'`;
    await tx`delete from public.players where nickname like 'SECTEST%'`;
  });
}

if (url) {
  beforeAll(async () => {
    await cleanup();
    await asSystem(async (tx) => {
      const [s] = await tx<{ public_sections: string[] }[]>`select public_sections from public.team_settings`;
      originalSections = s!.public_sections;
      zachPlayer = (await tx<{ id: string }[]>`insert into public.players (nickname) values ('SECTEST A') returning id`)[0]!.id;
      strykerPlayer = (await tx<{ id: string }[]>`insert into public.players (nickname) values ('SECTEST B') returning id`)[0]!.id;
      for (const [key, id] of Object.entries(ids)) {
        await tx`insert into auth.users (id, email) values (${id}, ${key + "@sec.test"})`;
      }
      await tx`insert into public.profiles (id, email, display_name, role, player_id, disabled) values
        (${ids.owner}, 'owner@sec.test', 'Owner', 'owner', null, false),
        (${ids.coach}, 'coach@sec.test', 'Coach', 'coach', null, false),
        (${ids.zach}, 'zach@sec.test', 'Zach', 'player', ${zachPlayer}, false),
        (${ids.stryker}, 'stryker@sec.test', 'Stryker', 'player', ${strykerPlayer}, false),
        (${ids.blocked}, 'blocked@sec.test', 'Blocked', 'player', null, true)`;
      await tx`insert into public.feedback (player_id, category, areas_to_improve) values
        (${zachPlayer}, 'Aim', 'SECTEST zach'), (${strykerPlayer}, 'Trading', 'SECTEST stryker')`;
      await tx`update public.team_settings set public_view_enabled = true, public_sections = '{overview,matches,analytics,roster}'`;
    });
  });

  afterAll(async () => {
    await cleanup();
    await asSystem((tx) => tx`update public.team_settings set public_view_enabled = true, public_sections = ${originalSections}`);
    await db().end();
  });
}

describe.skipIf(!url)("row level security", () => {
  it("lets visitors read branding and opened sections only", async () => {
    await withActor(null, async (tx) => {
      expect(await tx`select 1 from public.team_settings`).toHaveLength(1);
      expect((await tx`select 1 from public.matches`).length).toBeGreaterThan(0);
      expect(await tx`select 1 from public.feedback`).toHaveLength(0);
      expect(await tx`select 1 from public.player_details`).toHaveLength(0);
      expect(await tx`select 1 from public.profiles`).toHaveLength(0);
      expect(await tx`select 1 from public.strategies`).toHaveLength(0);
      expect(await tx`select 1 from public.match_coach_notes`).toHaveLength(0);
    });
  });

  it("blocks visitors from writing anything", async () => {
    await rejects(withActor(null, (tx) => tx`insert into public.opponents (name) values ('SECTEST visitor')`), "42501");
    await rejects(withActor(null, (tx) => tx`update public.team_settings set team_name = 'x'`), "42501");
  });

  it("hides everything from visitors when the owner makes the hub private", async () => {
    await withActor(as(ids.owner), (tx) => tx`update public.team_settings set public_view_enabled = false`);
    await withActor(null, async (tx) => {
      expect(await tx`select 1 from public.matches`).toHaveLength(0);
      expect(await tx`select 1 from public.players`).toHaveLength(0);
    });
    await withActor(as(ids.owner), (tx) => tx`update public.team_settings set public_view_enabled = true`);
  });

  it("shows a player only their own private feedback", async () => {
    const rows = await withActor(as(ids.zach), (tx) => tx<{ player_id: string }[]>`
      select player_id from public.feedback where areas_to_improve like 'SECTEST%'`);
    expect(rows.map((r) => r.player_id)).toEqual([zachPlayer]);
    const staffRows = await withActor(as(ids.coach), (tx) => tx`select 1 from public.feedback where areas_to_improve like 'SECTEST%'`);
    expect(staffRows).toHaveLength(2);
  });

  it("keeps coach notes away from players", async () => {
    const [m] = await asSystem((tx) => tx<{ id: string }[]>`select id from public.matches limit 1`);
    await withActor(as(ids.coach), (tx) => tx`insert into public.match_coach_notes (match_id, notes) values (${m!.id}, 'SECTEST')
      on conflict (match_id) do update set notes = excluded.notes`);
    expect(await withActor(as(ids.zach), (tx) => tx`select 1 from public.match_coach_notes`)).toHaveLength(0);
    expect((await withActor(as(ids.coach), (tx) => tx`select 1 from public.match_coach_notes`)).length).toBeGreaterThan(0);
    await asSystem((tx) => tx`delete from public.match_coach_notes where notes = 'SECTEST'`);
  });

  it("stops players from editing team data or their own role", async () => {
    await rejects(withActor(as(ids.zach), (tx) => tx`insert into public.opponents (name) values ('SECTEST player')`), "42501");
    const other = await withActor(as(ids.zach), (tx) => tx`update public.players set nickname = 'hacked' where id = ${strykerPlayer} returning id`);
    expect(other).toHaveLength(0);
    await rejects(withActor(as(ids.zach), (tx) => tx`update public.profiles set role = 'owner' where id = ${ids.zach}`), "42501");
    const renamed = await withActor(as(ids.zach), (tx) => tx`update public.profiles set display_name = 'Zach' where id = ${ids.zach} returning id`);
    expect(renamed).toHaveLength(1);
  });

  it("lets a player edit their own roster profile, within limits", async () => {
    const own = await withActor(as(ids.zach), (tx) => tx`
      update public.players set nickname = 'SECTEST A2', photo_url = 'https://example.test/a.png' where id = ${zachPlayer} returning id`);
    expect(own).toHaveLength(1);
    const [role] = await asSystem((tx) => tx<{ id: string }[]>`select id from public.team_roles limit 1`);
    await rejects(withActor(as(ids.zach), (tx) => tx`update public.players set main_role_id = ${role!.id} where id = ${zachPlayer}`), "42501");
    await rejects(withActor(as(ids.zach), (tx) => tx`update public.players set active = false where id = ${zachPlayer}`), "42501");
    await withActor(as(ids.zach), (tx) => tx`insert into public.player_details (player_id, real_name) values (${zachPlayer}, 'Zach Real')
      on conflict (player_id) do update set real_name = excluded.real_name`);
    await rejects(
      withActor(as(ids.zach), (tx) => tx`update public.player_details set strengths = 'I am the best' where player_id = ${zachPlayer}`),
      "42501",
    );
    const details = await withActor(as(ids.zach), (tx) => tx`
      update public.player_details set real_name = 'x' where player_id = ${strykerPlayer} returning player_id`);
    expect(details).toHaveLength(0);
    // Staff still edit everything.
    await withActor(as(ids.coach), (tx) => tx`update public.player_details set strengths = 'SECTEST' where player_id = ${zachPlayer}`);
    await withActor(as(ids.coach), (tx) => tx`update public.players set nickname = 'SECTEST A' where id = ${zachPlayer}`);
  });

  it("lets members upload photos only into their own folder", async () => {
    await withActor(as(ids.zach), (tx) => tx`
      insert into storage.objects (bucket_id, name) values ('media', ${`people/${ids.zach}/avatar-1.png`})`);
    await rejects(
      withActor(as(ids.zach), (tx) => tx`insert into storage.objects (bucket_id, name) values ('media', ${`people/${ids.stryker}/x.png`})`),
      "42501",
    );
    await rejects(withActor(as(ids.zach), (tx) => tx`insert into storage.objects (bucket_id, name) values ('media', 'branding/x.png')`), "42501");
    await asSystem((tx) => tx`delete from storage.objects where name like 'people/%'`);
  });

  it("treats blocked accounts as outsiders", async () => {
    await withActor(as(ids.blocked), async (tx) => {
      expect(await tx`select 1 from public.feedback`).toHaveLength(0);
      expect(await tx`select 1 from public.team_objectives`).toHaveLength(0);
    });
  });

  it("lets coaches invite players but not staff", async () => {
    await withActor(as(ids.coach), (tx) => tx`insert into public.invitations (code_hash, code_hint, role, note, expires_at)
      values ('sectest-1', 'AAAA', 'player', 'SECTEST', now() + interval '1 day')`);
    await rejects(
      withActor(as(ids.coach), (tx) => tx`insert into public.invitations (code_hash, code_hint, role, note, expires_at)
        values ('sectest-2', 'BBBB', 'coach', 'SECTEST', now() + interval '1 day')`),
      "42501",
    );
    expect(await withActor(as(ids.zach), (tx) => tx`select 1 from public.invitations`)).toHaveLength(0);
  });

  it("reserves visitor-access settings for the owner", async () => {
    await rejects(withActor(as(ids.coach), (tx) => tx`update public.team_settings set public_sections = '{playbook}'`), "42501");
    await withActor(as(ids.coach), (tx) => tx`update public.team_settings set season_label = season_label`);
  });

  it("never leaves the team without an owner", async () => {
    // Demoting every owner at once must fail on the last one.
    await rejects(withActor(as(ids.owner), (tx) => tx`update public.profiles set role = 'coach' where role = 'owner'`), "23514");
  });
});

describe.skipIf(!url)("match rules", () => {
  async function insertMatch(over: Record<string, unknown>) {
    return withActor(as(ids.coach), async (tx) => {
      const [map] = await tx<{ id: string }[]>`select id from public.maps where name = 'Ascent'`;
      const [opp] = await tx<{ id: string }[]>`select id from public.opponents limit 1`;
      const agents = await tx<{ id: string }[]>`select id from public.agents order by name limit 10`;
      const row = {
        played_on: "2026-11-01",
        match_type: "scrim",
        competition: "SECTEST",
        opponent_id: opp!.id,
        map_id: map!.id,
        our_agent_ids: agents.slice(0, 5).map((a) => a.id),
        opp_agent_ids: agents.slice(5, 10).map((a) => a.id),
        our_comp_key: "",
        opp_comp_key: "",
        season: "",
        our_t_rounds: 7,
        our_ct_rounds: 6,
        opp_t_rounds: 4,
        opp_ct_rounds: 5,
        ...over,
      };
      const [m] = await tx<{ our_score: number; opp_score: number; result: string; round_diff: number; season: string; our_comp_key: string }[]>`
        insert into public.matches ${tx(row)} returning our_score, opp_score, result, round_diff, season, our_comp_key`;
      return m!;
    });
  }

  it("calculates score, result, round difference and season", async () => {
    const m = await insertMatch({});
    expect(m).toMatchObject({ our_score: 13, opp_score: 9, result: "W", round_diff: 4, season: "2026/2027" });
  });

  it("supports overtime in official matches", async () => {
    const m = await insertMatch({ match_type: "official", our_t_rounds: 5, our_ct_rounds: 7, opp_t_rounds: 5, opp_ct_rounds: 7, our_ot_rounds: 3, opp_ot_rounds: 1 });
    expect(m).toMatchObject({ our_score: 15, opp_score: 13, result: "W" });
  });

  it("allows 12–12 draws in scrims only", async () => {
    expect((await insertMatch({ our_t_rounds: 6, our_ct_rounds: 6, opp_t_rounds: 6, opp_ct_rounds: 6 })).result).toBe("D");
    await rejects(insertMatch({ match_type: "official", our_t_rounds: 6, our_ct_rounds: 6, opp_t_rounds: 6, opp_ct_rounds: 6 }), "23514");
  });

  it("rejects impossible scores", async () => {
    await rejects(insertMatch({ our_ot_rounds: 2 }), "23514"); // overtime in a scrim
    await rejects(insertMatch({ our_t_rounds: 9, opp_ct_rounds: 5 }), "23514"); // 14 rounds in one half
    await rejects(insertMatch({ match_type: "official", our_ot_rounds: 2 }), "23514"); // overtime without 12–12
  });

  it("needs five different agents and ignores their order", async () => {
    const ids5 = (await asSystem((tx) => tx<{ id: string }[]>`select id from public.agents order by name limit 5`)).map((a) => a.id);
    const a = await insertMatch({ our_agent_ids: ids5 });
    const b = await insertMatch({ our_agent_ids: [...ids5].reverse() });
    expect(a.our_comp_key).toBe(b.our_comp_key);
    await rejects(insertMatch({ our_agent_ids: [ids5[0], ids5[0], ids5[1], ids5[2], ids5[3]] }), "23514");
  });

  it("does not let players record matches", async () => {
    await rejects(
      withActor(as(ids.zach), (tx) => tx`update public.matches set our_t_rounds = 12 where competition = 'SECTEST' returning id`).then((r) => {
        if (r.length === 0) throw Object.assign(new Error("no rows"), { code: "42501" });
      }),
      "42501",
    );
  });
});
