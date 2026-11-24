"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckboxField, FormAlert, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { useForm } from "@/lib/use-form";
import { AGENT_ROLE_LABEL, AGENT_ROLE_ORDER } from "@/lib/constants";
import { savePlayer } from "./actions";

type AgentOpt = { id: string; name: string; role: string };

export type PlayerInitial = {
  id?: string;
  nickname: string;
  real_name: string;
  photo_url: string;
  main_role_id: string;
  secondary_role_id: string;
  main_agent_ids: string[];
  secondary_agent_ids: string[];
  strengths: string;
  weaknesses: string;
  notes: string;
  active: boolean;
};

type Pick = "main" | "secondary" | undefined;

export function PlayerForm({ initial, roles, agents }: { initial: PlayerInitial; roles: { id: string; name: string }[]; agents: AgentOpt[] }) {
  const [state, formAction] = useForm(savePlayer);
  const v = state.values;
  const [picks, setPicks] = useState<Record<string, Pick>>(() => {
    const out: Record<string, Pick> = {};
    initial.main_agent_ids.forEach((a) => (out[a] = "main"));
    initial.secondary_agent_ids.forEach((a) => (out[a] = out[a] ?? "secondary"));
    return out;
  });
  const cycle = (id: string) =>
    setPicks((p) => ({ ...p, [id]: p[id] === undefined ? "main" : p[id] === "main" ? "secondary" : undefined }));
  const roleOptions = [{ value: "", label: "Not set" }, ...roles.map((r) => ({ value: r.id, label: r.name }))];

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-8" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state.error} />
      <FormSection title="Player">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nickname" name="nickname" defaultValue={v?.nickname ?? initial.nickname} required maxLength={30} error={state.fields.nickname} />
          <TextField label="Real name" name="real_name" defaultValue={v?.real_name ?? initial.real_name} maxLength={80} hint="Only team members see it." />
          <SelectField label="Main role" name="main_role_id" defaultValue={v?.main_role_id ?? initial.main_role_id} options={roleOptions} />
          <SelectField label="Secondary role" name="secondary_role_id" defaultValue={v?.secondary_role_id ?? initial.secondary_role_id} options={roleOptions} />
        </div>
        <div className="mt-5">
          <ImageField label="Photo" name="photo_url" initial={initial.photo_url} kind="player" error={state.fields.photo_url} />
        </div>
        <CheckboxField className="mt-5" label="Active in the roster" name="active" defaultChecked={initial.active} hint="Inactive players keep their history but aren't offered in forms." />
      </FormSection>

      <FormSection title="Agent pool" description="Tap an agent once for main, twice for secondary, a third time to clear.">
        <div className="flex flex-col gap-4">
          {AGENT_ROLE_ORDER.map((role) => (
            <div key={role}>
              <p className="mb-2 text-[13px] text-fog">{AGENT_ROLE_LABEL[role]}s</p>
              <div className="flex flex-wrap gap-2">
                {agents
                  .filter((a) => a.role === role)
                  .map((a) => {
                    const pick = picks[a.id];
                    return (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => cycle(a.id)}
                        aria-pressed={Boolean(pick)}
                        className={clsx(
                          "h-9 border px-3 text-[14px] transition-colors",
                          pick === "main" && "border-accent bg-accent/15 text-bone",
                          pick === "secondary" && "border-bone/50 bg-white/[0.06] text-bone",
                          !pick && "border-line text-fog hover:text-bone",
                        )}
                      >
                        {a.name}
                        {pick ? <span className="ml-1.5 text-[11px] uppercase tracking-wide opacity-75">{pick}</span> : null}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
        {Object.entries(picks).map(([id, pick]) =>
          pick ? <input key={id} type="hidden" name={pick === "main" ? "main_agent" : "secondary_agent"} value={id} /> : null,
        )}
      </FormSection>

      <FormSection title="Scouting report" description="Visible to team members only.">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextAreaField label="Strengths" name="strengths" defaultValue={v?.strengths ?? initial.strengths} maxLength={4000} />
          <TextAreaField label="Weaknesses" name="weaknesses" defaultValue={v?.weaknesses ?? initial.weaknesses} maxLength={4000} />
          <TextAreaField label="Notes" name="notes" defaultValue={v?.notes ?? initial.notes} maxLength={4000} className="lg:col-span-2" />
        </div>
      </FormSection>

      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving…">{initial.id ? "Save player" : "Add player"}</SubmitButton>
      </div>
    </form>
  );
}
