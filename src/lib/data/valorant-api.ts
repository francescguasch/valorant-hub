import "server-only";

/**
 * Agent portraits and map images from valorant-api.com, a free community API.
 * Looked up by name and cached for a day. If the API is unreachable the app
 * falls back to initials; an image uploaded in Settings always wins.
 */
type Lookup = Record<string, string>;

// Overridable only so local tests can run without internet access.
const API = process.env.VALORANT_API_URL ?? "https://valorant-api.com";

async function fetchJson(url: string): Promise<{ data?: unknown[] } | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(3_000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function agentImages(): Promise<Lookup> {
  const json = await fetchJson(`${API}/v1/agents?isPlayableCharacter=true`);
  const out: Lookup = {};
  for (const a of (json?.data ?? []) as { displayName?: string; displayIconSmall?: string; displayIcon?: string }[]) {
    const url = a.displayIconSmall ?? a.displayIcon;
    if (a.displayName && url) out[a.displayName.toLowerCase()] = url;
  }
  return out;
}

export async function mapImages(): Promise<{ wide: Lookup; splash: Lookup }> {
  const json = await fetchJson(`${API}/v1/maps`);
  const wide: Lookup = {};
  const splash: Lookup = {};
  for (const m of (json?.data ?? []) as { displayName?: string; listViewIcon?: string; splash?: string }[]) {
    if (!m.displayName) continue;
    const key = m.displayName.toLowerCase();
    if (m.listViewIcon) wide[key] = m.listViewIcon;
    if (m.splash) splash[key] = m.splash;
  }
  return { wide, splash };
}

type ApiMap = {
  displayName?: string;
  displayIcon?: string | null;
  xMultiplier?: number;
  yMultiplier?: number;
  xScalarToAdd?: number;
  yScalarToAdd?: number;
  callouts?: { regionName: string; superRegionName: string; location: { x: number; y: number } }[] | null;
};
type ApiAgent = {
  displayName?: string;
  displayIcon?: string | null;
  abilities?: { slot: string; displayName: string; displayIcon: string | null }[];
};

export type BoardAssets = {
  maps: Record<
    string,
    {
      minimap: string | null;
      /** Minimap widths per in-game metre (1 m = 100 units). */
      perMetre: number | null;
      callouts: { superRegion: string; region: string; x: number; y: number }[];
    }
  >;
  agents: Record<string, { icon: string | null; abilities: { slot: string; name: string; icon: string | null }[] }>;
};

// Keyboard order in game: C, Q, E, X.
const SLOT_ORDER = ["Grenade", "Ability1", "Ability2", "Ultimate"];

/** Minimaps with callout positions (0–1 across the minimap) and agent abilities, for tactics boards. */
export async function boardAssets(): Promise<BoardAssets> {
  const [maps, agents] = await Promise.all([
    fetchJson(`${API}/v1/maps`),
    fetchJson(`${API}/v1/agents?isPlayableCharacter=true`),
  ]);
  const out: BoardAssets = { maps: {}, agents: {} };
  for (const m of (maps?.data ?? []) as ApiMap[]) {
    if (!m.displayName || !m.displayIcon) continue;
    const { xMultiplier: xm = 0, yMultiplier: ym = 0, xScalarToAdd: xa = 0, yScalarToAdd: ya = 0 } = m;
    out.maps[m.displayName.toLowerCase()] = {
      minimap: m.displayIcon,
      perMetre: xm ? Math.abs(xm) * 100 : null,
      // valorant-api: minimap x comes from the game's y axis and vice versa.
      callouts: (m.callouts ?? []).map((c) => ({
        superRegion: c.superRegionName,
        region: c.regionName,
        x: c.location.y * xm + xa,
        y: c.location.x * ym + ya,
      })),
    };
  }
  for (const a of (agents?.data ?? []) as ApiAgent[]) {
    if (!a.displayName) continue;
    out.agents[a.displayName.toLowerCase()] = {
      icon: a.displayIcon ?? null,
      abilities: (a.abilities ?? [])
        .filter((ab) => SLOT_ORDER.includes(ab.slot))
        .sort((x, y) => SLOT_ORDER.indexOf(x.slot) - SLOT_ORDER.indexOf(y.slot))
        .map((ab) => ({ slot: ab.slot, name: ab.displayName, icon: ab.displayIcon })),
    };
  }
  return out;
}
