"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { canvasToBlob, renderBoard } from "@/lib/boards/render-canvas";
import type { BoardCatalog, Scene } from "@/lib/boards/scene";

/** Draws the board fresh and downloads it as a PNG. */
export function BoardDownloadButton({
  scene,
  catalog,
  mapId,
  fileName,
  fallbackUrl,
}: {
  scene: Scene;
  catalog: BoardCatalog;
  mapId: string | null;
  fileName: string;
  fallbackUrl: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setProblem(null);
    try {
      const canvas = await renderBoard(scene, catalog, mapId, 1600);
      const blob = await canvasToBlob(canvas, "image/png");
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else if (fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener");
      } else {
        setProblem("This board can't be turned into an image in this browser.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={download} disabled={busy} className={buttonClass("secondary")}>
        <Download className="size-4" aria-hidden /> {busy ? "Preparing…" : "Download image"}
      </button>
      {problem ? <p className="text-[13px] text-accent">{problem}</p> : null}
    </div>
  );
}
