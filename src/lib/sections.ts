export type SectionKey =
  | "overview"
  | "playbook"
  | "matches"
  | "scouting"
  | "analytics"
  | "roster"
  | "development"
  | "vod"
  | "practice"
  | "settings";

export type Section = {
  key: SectionKey;
  href: string;
  label: string;
  blurb: string;
  /** Can the owner open this section to visitors without an account? */
  publicable: boolean;
};

export const SECTIONS: Section[] = [
  { key: "overview", href: "/", label: "Overview", blurb: "Team dashboard", publicable: true },
  { key: "playbook", href: "/playbook", label: "Map Playbook", blurb: "Maps and strategies", publicable: true },
  { key: "matches", href: "/matches", label: "Match Center", blurb: "Results and maps played", publicable: true },
  { key: "scouting", href: "/scouting", label: "Opponent Scouting", blurb: "Rivals and history", publicable: true },
  { key: "analytics", href: "/analytics", label: "Team Analytics", blurb: "Maps and compositions", publicable: true },
  { key: "roster", href: "/roster", label: "Roster", blurb: "Players and roles", publicable: true },
  { key: "development", href: "/development", label: "Player Development", blurb: "Feedback and goals", publicable: false },
  { key: "vod", href: "/vod", label: "VOD Review", blurb: "Mistakes and lessons", publicable: true },
  { key: "practice", href: "/practice", label: "Practice Planner", blurb: "Training calendar", publicable: true },
  { key: "settings", href: "/settings", label: "Settings", blurb: "Team, members and data", publicable: false },
];

export const PUBLICABLE_SECTIONS = SECTIONS.filter((s) => s.publicable).map((s) => s.key);

export function sectionByKey(key: SectionKey): Section {
  return SECTIONS.find((s) => s.key === key)!;
}
