import "server-only";
import { cache } from "react";
import { withActor } from "../db";

export type TeamSettings = {
  university_name: string;
  team_name: string;
  hero_kicker: string;
  hero_tagline: string;
  season_label: string;
  logo_url: string | null;
  hero_image_url: string;
  accent_color: string;
  secondary_color: string;
  timezone: string;
  public_view_enabled: boolean;
  public_sections: string[];
};

/** Branding and access settings. Readable by everyone, including visitors. */
export const getSettings = cache(async (): Promise<TeamSettings> => {
  const rows = await withActor(null, (tx) => tx<TeamSettings[]>`
    select university_name, team_name, hero_kicker, hero_tagline, season_label, logo_url, hero_image_url,
           accent_color, secondary_color, timezone, public_view_enabled, public_sections
    from public.team_settings where id`);
  return rows[0];
});
