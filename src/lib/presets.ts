/**
 * One codebase, several deployments. Each Vercel project sets TEAM_PRESET and
 * gets its own database; on the very first start (no accounts yet) the preset
 * sets the team's branding and roster. After that everything is edited in the
 * app as usual. UND is the default and changes nothing.
 */
export type PresetKey = "und" | "hawaii" | "showcase";

export type PresetPlayer = { nickname: string; role?: string; secondary?: string; realName?: string; photo?: string };

export type Preset = {
  key: PresetKey;
  /** The home page photo, and what "Use original photo" goes back to. */
  heroImage: string;
  /** Team photo on the Roster page, if any. */
  rosterImage?: string;
  settings: {
    university_name: string;
    team_name: string;
    hero_kicker: string;
    hero_tagline: string;
    season_label: string;
    timezone: string;
    accent_color: string;
    /** Visitors see real names under the nicknames. */
    show_real_names?: boolean;
  };
  /** Replaces the starting roster; null keeps the one from the migrations. */
  roster: PresetPlayer[] | null;
  /** Player roles to add to the catalogue (e.g. IGL). */
  extraRoles?: string[];
  /**
   * Read-only portfolio showcase: no sign-in, every section open to visitors,
   * a fictional pro team with a full season of data.
   */
  showcase: boolean;
};

const PRESETS: Record<PresetKey, Preset> = {
  und: {
    key: "und",
    heroImage: "/brand/campus-und.jpg",
    settings: {
      university_name: "University of North Dakota",
      team_name: "VALORANT Team",
      hero_kicker: "University esports · Competitive division",
      hero_tagline: "Team management · Performance · Strategy",
      season_label: "2026 / 2027",
      timezone: "America/Chicago",
      accent_color: "#FF4655",
    },
    roster: null,
    showcase: false,
  },
  hawaii: {
    key: "hawaii",
    heroImage: "/brand/campus-hawaii.jpg",
    rosterImage: "/brand/hawaii/team.jpg",
    extraRoles: ["IGL"],
    settings: {
      university_name: "University of Hawaiʻi",
      team_name: "VALORANT Team",
      hero_kicker: "University esports · Competitive division",
      hero_tagline: "Team management · Performance · Strategy",
      season_label: "2026 / 2027",
      timezone: "Pacific/Honolulu",
      accent_color: "#FF4655",
      show_real_names: true,
    },
    roster: [
      // In-game names and real names, as the team gave them: top row of the photo, then bottom row.
      { nickname: "peps", realName: "Peyton", role: "Initiator", secondary: "IGL", photo: "/brand/hawaii/peps.jpg" },
      {
        nickname: "AmazingPenguin48",
        realName: "Skye",
        role: "Second Entry",
        photo: "/brand/hawaii/amazingpenguin48.jpg",
      },
      { nickname: "chizuru", realName: "Duke", role: "Controller / Smoker", photo: "/brand/hawaii/chizuru.jpg" },
      { nickname: "fracturrr", realName: "Wade", role: "Sentinel", photo: "/brand/hawaii/fracturrr.jpg" },
      { nickname: "Ngoc Nga", realName: "Nga", photo: "/brand/hawaii/ngoc-nga.jpg" },
      { nickname: "wisteria", realName: "Zach", photo: "/brand/hawaii/wisteria.jpg" },
    ],
    showcase: false,
  },
  showcase: {
    key: "showcase",
    heroImage: "/brand/showcase-hero.jpg",
    settings: {
      university_name: "Meridian Six",
      team_name: "VALORANT Division",
      hero_kicker: "Professional esports · Portfolio showcase",
      hero_tagline: "Team management · Performance · Strategy",
      season_label: "2026 season",
      timezone: "Europe/Madrid",
      accent_color: "#FF4655",
    },
    roster: [
      { nickname: "Vesper", role: "Main Entry", secondary: "Second Entry", realName: "Fictional player" },
      { nickname: "Kestrel", role: "Initiator", realName: "Fictional player" },
      { nickname: "Lumen", role: "Controller / Smoker", realName: "Fictional player" },
      { nickname: "Rook", role: "Sentinel", realName: "Fictional player" },
      { nickname: "Sable", role: "Second Entry", secondary: "Initiator", realName: "Fictional player" },
      { nickname: "Quill", role: "Controller / Smoker", secondary: "Sentinel", realName: "Fictional player" },
    ],
    showcase: true,
  },
};

export function currentPreset(): Preset {
  const key = (process.env.TEAM_PRESET ?? "und").toLowerCase() as PresetKey;
  return PRESETS[key] ?? PRESETS.und;
}

/** True on the read-only portfolio deployment. */
export const isShowcase = () => currentPreset().showcase;
