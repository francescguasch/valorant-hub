"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { ImageUp, RotateCcw } from "lucide-react";
import { buttonClass } from "./button";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

const MAX_BYTES = 8 * 1024 * 1024;

/** Uploads an image straight to Supabase Storage (staff only) and keeps its URL in a hidden input. */
export function ImageField({
  label,
  name,
  initial,
  kind,
  folder = "branding",
  resetTo,
  wide,
  round,
  error,
}: {
  label: string;
  name: string;
  initial: string;
  kind: string;
  /** Storage folder. Staff upload anywhere; other members only into people/<their user id>. */
  folder?: string;
  round?: boolean;
  resetTo?: string;
  wide?: boolean;
  error?: string;
}) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setProblem(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setProblem("Use a JPG, PNG or WebP image.");
    if (file.size > MAX_BYTES) return setProblem("That image is over 8 MB. Use a smaller one.");
    setBusy(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${folder}/${kind}-${Date.now()}.${ext}`;
    const supabase = createSupabaseBrowser();
    const { error: upErr } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (upErr) return setProblem(`Upload failed: ${upErr.message}`);
    setUrl(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-fog">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={
            wide
              ? "aspect-[16/9] w-full max-w-sm overflow-hidden border border-line bg-rail"
              : round
                ? "grid size-24 place-items-center overflow-hidden rounded-full border border-line bg-rail"
                : "grid size-24 place-items-center border border-line bg-rail"
          }
        >
          {url ? (
            <img
              src={url}
              alt=""
              className={wide || round ? "size-full object-cover" : "max-h-20 max-w-20 object-contain"}
            />
          ) : (
            <span className="text-[12px] text-dim">No image</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={`Upload ${label}`}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button type="button" className={buttonClass("secondary")} onClick={() => inputRef.current?.click()} disabled={busy}>
            <ImageUp className="size-4" aria-hidden /> {busy ? "Uploading…" : "Upload image"}
          </button>
          {resetTo && url !== resetTo ? (
            <button type="button" className={buttonClass("ghost")} onClick={() => setUrl(resetTo)}>
              <RotateCcw className="size-4" aria-hidden /> Use original photo
            </button>
          ) : null}
          {!resetTo && url ? (
            <button type="button" className={buttonClass("ghost")} onClick={() => setUrl("")}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {problem || error ? <p className="text-[13px] text-loss">{problem ?? error}</p> : null}
      <p className="text-[12.5px] text-dim">JPG, PNG or WebP up to 8 MB. Changes apply when you save.</p>
    </div>
  );
}
