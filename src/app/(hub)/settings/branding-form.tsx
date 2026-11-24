"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { ImageUp, RotateCcw } from "lucide-react";
import { FormAlert, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { useForm } from "@/lib/use-form";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import type { TeamSettings } from "@/lib/data/settings";
import { updateBranding } from "./actions";

const DEFAULT_HERO = "/brand/campus-und.jpg";
const MAX_BYTES = 8 * 1024 * 1024;

export function BrandingForm({ settings, timezones }: { settings: TeamSettings; timezones: string[] }) {
  const [state, formAction] = useForm(updateBranding);
  const [accent, setAccent] = useState(settings.accent_color);
  const [secondary, setSecondary] = useState(settings.secondary_color);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-8" noValidate>
      <FormAlert error={state.error} success={state.success} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="type-display mb-4 text-[19px] font-bold">Names</legend>
        <TextField label="University name" name="university_name" defaultValue={state.values?.university_name ?? settings.university_name} required error={state.fields.university_name} />
        <TextField label="Team name" name="team_name" defaultValue={state.values?.team_name ?? settings.team_name} required error={state.fields.team_name} />
        <TextField
          label="Line above the name on the home page"
          name="hero_kicker"
          defaultValue={settings.hero_kicker}
          error={state.fields.hero_kicker}
        />
        <TextField label="Line below the name" name="hero_tagline" defaultValue={state.values?.hero_tagline ?? settings.hero_tagline} error={state.fields.hero_tagline} />
        <TextField label="Season" name="season_label" defaultValue={state.values?.season_label ?? settings.season_label} required error={state.fields.season_label} />
        <SelectField
          label="Team timezone"
          name="timezone"
          defaultValue={state.values?.timezone ?? settings.timezone}
          hint="Practice times are shown in this timezone."
          options={timezones.map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") }))}
          error={state.fields.timezone}
        />
      </fieldset>

      <fieldset className="grid gap-6">
        <legend className="type-display mb-4 text-[19px] font-bold">Images</legend>
        <ImageField
          label="Campus photo (home page cover)"
          name="hero_image_url"
          initial={settings.hero_image_url}
          kind="hero"
          resetTo={DEFAULT_HERO}
          wide
          error={state.fields.hero_image_url}
        />
        <ImageField label="Team logo" name="logo_url" initial={settings.logo_url ?? ""} kind="logo" error={state.fields.logo_url} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="type-display mb-4 text-[19px] font-bold">Colours</legend>
        <ColorField label="Accent colour" name="accent_color" value={accent} onChange={setAccent} hint="Buttons, highlights and the home page glow." error={state.fields.accent_color} />
        <ColorField label="Secondary colour" name="secondary_color" value={secondary} onChange={setSecondary} hint="Bars in charts." error={state.fields.secondary_color} />
      </fieldset>

      <div>
        <SubmitButton>Save team details</SubmitButton>
      </div>
    </form>
  );
}

function ColorField({
  label,
  name,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`f-${name}`} className="text-[13px] font-medium text-fog">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-[42px] w-14 cursor-pointer border border-line-strong bg-rail p-1"
        />
        <input
          id={`f-${name}`}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field font-display tracking-[0.06em]"
          maxLength={7}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <p className={error ? "text-[13px] text-loss" : "text-[13px] text-dim"}>{error ?? hint}</p>
    </div>
  );
}

function ImageField({
  label,
  name,
  initial,
  kind,
  resetTo,
  wide,
  error,
}: {
  label: string;
  name: string;
  initial: string;
  kind: string;
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
    const path = `branding/${kind}-${Date.now()}.${ext}`;
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
        <div className={wide ? "aspect-[16/9] w-full max-w-sm overflow-hidden border border-line bg-rail" : "grid size-24 place-items-center border border-line bg-rail"}>
          {url ? (
            <img src={url} alt="" className={wide ? "size-full object-cover" : "max-h-20 max-w-20 object-contain"} />
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
