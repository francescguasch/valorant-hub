import "server-only";
import type { Tx } from "../db";
import { currentPreset } from "../presets";
import { PUBLICABLE_SECTIONS } from "../sections";
import { seedShowcase } from "./showcase";

/**
 * Runs once per database, right after the migrations: gives a new deployment
 * its team (branding and roster). A database that already has accounts or
 * real matches is left untouched and only recorded, so the preset can never
 * overwrite a team's work.
 */
export async function applyPreset(tx: Tx): Promise<string | null> {
  const preset = currentPreset();
  await tx`create table if not exists app.deployment (key text primary key, value text not null, applied_at timestamptz not null default now())`;
  const [done] = await tx<{ value: string }[]>`select value from app.deployment where key = 'preset'`;
  if (done) return null;

  const [usage] = await tx<{ accounts: number; matches: number }[]>`
    select (select count(*) from public.profiles)::int as accounts,
           (select count(*) from public.matches where not is_demo)::int as matches`;
  const fresh = usage!.accounts === 0 && usage!.matches === 0;
  if (fresh && preset.key !== "und") {
    const s = preset.settings;
    await tx`
      update public.team_settings set university_name = ${s.university_name}, team_name = ${s.team_name},
        hero_kicker = ${s.hero_kicker}, hero_tagline = ${s.hero_tagline}, season_label = ${s.season_label},
        timezone = ${s.timezone}, accent_color = ${s.accent_color}, hero_image_url = ${preset.heroImage},
        roster_image_url = ${preset.rosterImage ?? null}`;

    let roleOrder = 100;
    for (const role of preset.extraRoles ?? []) {
      await tx`insert into public.team_roles (name, sort_order) values (${role}, ${roleOrder++}) on conflict do nothing`;
    }

    if (preset.roster) {
      await tx`delete from public.players`;
      let order = 0;
      for (const p of preset.roster) {
        const [row] = await tx<{ id: string }[]>`
          insert into public.players (nickname, photo_url, main_role_id, secondary_role_id, sort_order)
          values (${p.nickname}, ${p.photo ?? null},
            (select id from public.team_roles where lower(name) = lower(${p.role ?? ""})),
            (select id from public.team_roles where lower(name) = lower(${p.secondary ?? ""})),
            ${order++})
          returning id`;
        await tx`insert into public.player_details (player_id, real_name) values (${row!.id}, ${p.realName ?? null})`;
      }
    }

    if (preset.showcase) {
      await tx`select app.clear_demo_data()`;
      await seedShowcase(tx);
      await tx`update public.team_settings set public_view_enabled = true, public_sections = ${PUBLICABLE_SECTIONS}`;
    }
  }
  await tx`insert into app.deployment (key, value) values ('preset', ${fresh ? preset.key : `kept:${preset.key}`})`;
  return fresh ? preset.key : null;
}
