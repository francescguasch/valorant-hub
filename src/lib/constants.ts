/** Fixed vocabularies used across the hub. Labels are what people see. */

export const MATCH_TYPES = [
  { value: "scrim", label: "Scrim" },
  { value: "official", label: "Official" },
  { value: "tournament", label: "Tournament" },
] as const;
export const MATCH_TYPE_LABEL: Record<string, string> = { scrim: "Scrim", official: "Official", tournament: "Tournament" };

export const AGENT_ROLE_LABEL: Record<string, string> = {
  duelist: "Duelist",
  initiator: "Initiator",
  controller: "Controller",
  sentinel: "Sentinel",
};
export const AGENT_ROLE_ORDER = ["duelist", "initiator", "controller", "sentinel"];

export const T_CATEGORIES = [
  { value: "default", label: "Default setups" },
  { value: "map_control", label: "Map control" },
  { value: "early_round", label: "Early-round strategies" },
  { value: "mid_round", label: "Mid-round decisions" },
  { value: "execute", label: "Executes" },
  { value: "split", label: "Splits" },
  { value: "fake", label: "Fakes" },
  { value: "post_plant", label: "Post-plants" },
  { value: "pistol", label: "Pistol rounds" },
  { value: "anti_eco", label: "Anti-eco" },
  { value: "bonus", label: "Bonus rounds" },
  { value: "force_buy", label: "Force buys" },
] as const;

export const CT_CATEGORIES = [
  { value: "defensive_default", label: "Defensive defaults" },
  { value: "site_setup", label: "Site setups" },
  { value: "rotation", label: "Rotations" },
  { value: "retake", label: "Retakes" },
  { value: "anti_rush", label: "Anti-rush" },
  { value: "utility_setup", label: "Utility setups" },
  { value: "pistol", label: "Pistol rounds" },
  { value: "anti_eco", label: "Anti-eco" },
  { value: "bonus", label: "Bonus rounds" },
] as const;

export function categoriesFor(side: "t" | "ct") {
  return side === "t" ? T_CATEGORIES : CT_CATEGORIES;
}
export function categoryLabel(side: "t" | "ct", value: string): string {
  return categoriesFor(side).find((c) => c.value === value)?.label ?? value;
}

export const SIDE_LABEL = { t: "T side", ct: "CT side" } as const;

export const STRATEGY_STATUS = [
  { value: "in_development", label: "In development" },
  { value: "practicing", label: "Practicing" },
  { value: "approved", label: "Approved" },
] as const;
export const STRATEGY_STATUS_LABEL: Record<string, string> = {
  in_development: "In development",
  practicing: "Practicing",
  approved: "Approved",
};

/** Player development and VOD review categories. */
export const SKILL_CATEGORIES = [
  "Mechanics",
  "Aim",
  "Positioning",
  "Game sense",
  "Decision making",
  "Communication",
  "Utility usage",
  "Trading",
  "Clutch",
  "Mentality",
  "Teamplay",
  "Role execution",
] as const;

export const FEEDBACK_STATUS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
] as const;
export const FEEDBACK_STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };

export const GOAL_STATUS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "achieved", label: "Achieved" },
  { value: "missed", label: "Missed" },
] as const;
export const GOAL_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  achieved: "Achieved",
  missed: "Missed",
};

export const SESSION_TYPES = [
  "Strategy practice",
  "Scrim block",
  "Aim and mechanics",
  "VOD review",
  "Team meeting",
  "Official match prep",
  "Other",
] as const;

export const SESSION_STATUS_LABEL: Record<string, string> = { planned: "Planned", completed: "Completed", cancelled: "Cancelled" };
