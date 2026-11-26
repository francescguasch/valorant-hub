"use client";

import { useState } from "react";
import { FormAlert, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { useForm } from "@/lib/use-form";
import { ImageField } from "@/components/ui/image-field";
import type { TeamSettings } from "@/lib/data/settings";
import { updateBranding } from "./actions";

export function BrandingForm({
  settings,
  timezones,
  defaultHero,
}: {
  settings: TeamSettings;
  timezones: string[];
  /** This deployment's original campus photo (see src/lib/presets.ts). */
  defaultHero: string;
}) {
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
          resetTo={defaultHero}
          wide
          error={state.fields.hero_image_url}
        />
        <ImageField
          label="Team photo (Roster page cover, optional)"
          name="roster_image_url"
          initial={settings.roster_image_url ?? ""}
          kind="roster"
          wide
          error={state.fields.roster_image_url}
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
