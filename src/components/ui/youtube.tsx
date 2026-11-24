import { ExternalLink, PlayCircle } from "lucide-react";
import { buttonClass } from "./button";

/** Extracts the video id and start time from any common YouTube link format. */
export function parseYouTube(url: string | null | undefined): { id: string; start: number } | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
    else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
        id = m?.[1] ?? null;
      }
    }
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    const t = u.searchParams.get("t") ?? u.searchParams.get("start") ?? "0";
    const start = /^\d+$/.test(t)
      ? Number(t)
      : (Number(t.match(/(\d+)h/)?.[1] ?? 0) * 3600 + Number(t.match(/(\d+)m/)?.[1] ?? 0) * 60 + Number(t.match(/(\d+)s/)?.[1] ?? 0));
    return { id, start };
  } catch {
    return null;
  }
}

/** Embedded player when the link is YouTube; always a plain "Watch video" link too. */
export function VideoBlock({ url, title }: { url: string | null; title: string }) {
  if (!url) return null;
  const yt = parseYouTube(url);
  return (
    <div className="flex flex-col gap-3">
      {yt ? (
        <div className="aspect-video w-full max-w-3xl overflow-hidden border border-line bg-black">
          <iframe
            className="size-full"
            src={`https://www.youtube-nocookie.com/embed/${yt.id}${yt.start ? `?start=${yt.start}` : ""}`}
            title={title}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : null}
      <div>
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
          {yt ? <PlayCircle className="size-4" aria-hidden /> : <ExternalLink className="size-4" aria-hidden />}
          Watch video
        </a>
      </div>
    </div>
  );
}
