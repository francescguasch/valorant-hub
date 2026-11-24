"use client";

import { CheckboxField, FormAlert, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { useForm } from "@/lib/use-form";
import { FEEDBACK_STATUS, SKILL_CATEGORIES } from "@/lib/constants";
import { saveVod } from "./actions";

type Opt = { value: string; label: string };

export type VodInitial = {
  id?: string;
  match_id: string;
  map_id: string;
  round_number: string;
  video_timestamp: string;
  clip_url: string;
  player_id: string;
  category: string;
  what_happened: string;
  should_have_happened: string;
  improvement_action: string;
  assigned_player_id: string;
  status: string;
  hasTask: boolean;
};

export function VodForm({ initial, matches, maps, players }: { initial: VodInitial; matches: Opt[]; maps: Opt[]; players: Opt[] }) {
  const [state, formAction] = useForm(saveVod);
  const v = state.values;
  const g = (k: keyof VodInitial) => v?.[k] ?? (initial[k] as string);
  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-8" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state.error} />
      <FormSection title="Moment">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Match" name="match_id" defaultValue={g("match_id")} options={[{ value: "", label: "Not from a recorded match" }, ...matches]} className="lg:col-span-2" />
          <SelectField label="Map" name="map_id" defaultValue={g("map_id")} options={[{ value: "", label: "Same as the match" }, ...maps]} />
          <TextField label="Round" name="round_number" type="number" min={1} max={60} defaultValue={g("round_number")} error={state.fields.round_number} />
          <TextField label="Timestamp in the video" name="video_timestamp" defaultValue={g("video_timestamp")} placeholder="12:34" error={state.fields.video_timestamp} />
          <TextField label="Clip link" name="clip_url" type="url" defaultValue={g("clip_url")} placeholder="https://… (optional)" error={state.fields.clip_url} hint="Without a clip, the match VOD opens at the timestamp." />
        </div>
      </FormSection>
      <FormSection title="Analysis">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Player involved" name="player_id" defaultValue={g("player_id")} options={[{ value: "", label: "Whole team" }, ...players]} />
          <SelectField label="Category" name="category" defaultValue={g("category")} options={[{ value: "", label: "Pick a category" }, ...SKILL_CATEGORIES.map((c) => ({ value: c, label: c }))]} error={state.fields.category} />
          <TextAreaField label="What happened" name="what_happened" defaultValue={g("what_happened")} maxLength={4000} error={state.fields.what_happened} />
          <TextAreaField label="What should have happened" name="should_have_happened" defaultValue={g("should_have_happened")} maxLength={4000} />
          <TextAreaField label="Solution / improvement action" name="improvement_action" defaultValue={g("improvement_action")} maxLength={4000} error={state.fields.improvement_action} className="sm:col-span-2" />
          <SelectField label="Assigned to" name="assigned_player_id" defaultValue={g("assigned_player_id")} options={[{ value: "", label: "Nobody yet" }, ...players]} error={state.fields.assigned_player_id} />
          <SelectField label="Status" name="status" defaultValue={g("status")} options={FEEDBACK_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
        </div>
        {!initial.hasTask ? (
          <CheckboxField
            className="mt-5"
            name="create_task"
            label="Create an improvement task"
            hint="Adds private feedback for the assigned player (or the player involved) in Player Development."
            defaultChecked={v?.create_task === "on"}
          />
        ) : (
          <p className="mt-5 text-[13.5px] text-fog">An improvement task was already created from this review.</p>
        )}
      </FormSection>
      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving…">{initial.id ? "Save review" : "Add review"}</SubmitButton>
      </div>
    </form>
  );
}
