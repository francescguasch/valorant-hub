import "server-only";

/**
 * Agent portraits and map images from valorant-api.com, a free community API.
 * Looked up by name and cached for a day. If the API is unreachable the app
 * falls back to initials; an image uploaded in Settings always wins.
 */
type Lookup = Record<string, string>;

async function fetchJson(url: string): Promise<{ data?: unknown[] } | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(3_000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function agentImages(): Promise<Lookup> {
  const json = await fetchJson("https://valorant-api.com/v1/agents?isPlayableCharacter=true");
  const out: Lookup = {};
  for (const a of (json?.data ?? []) as { displayName?: string; displayIconSmall?: string; displayIcon?: string }[]) {
    const url = a.displayIconSmall ?? a.displayIcon;
    if (a.displayName && url) out[a.displayName.toLowerCase()] = url;
  }
  return out;
}

export async function mapImages(): Promise<{ wide: Lookup; splash: Lookup }> {
  const json = await fetchJson("https://valorant-api.com/v1/maps");
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
