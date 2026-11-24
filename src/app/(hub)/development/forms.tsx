"use client";

import { useState } from "react";
import { FormAlert, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { useForm } from "@/lib/use-form";
import { FEEDBACK_STATUS, GOAL_STATUS, SKILL_CATEGORIES } from "@/lib/constants";
import { saveFeedback, saveGoal, saveObjective } from "./actions";

type Opt = { value: string; label: string };

const dateField = "[&_input]:[color-scheme:dark]";

export type FeedbackInitial = {
  id?: string;
  player_id: string;
  given_on: string;
  category: string;
  status: string;
  match_id: string;
  practice_session_id: string;
  strengths: string;
  areas_to_improve: string;
  specific_example: string;
  evidence: string;
  vod_clip_url: string;
  improvement_action: string;
  follow_up_on: string;
};

export function FeedbackForm({ initial, players, matches, sessions }: { initial: FeedbackInitial; players: Opt[]; matches: Opt[]; sessions: Opt[] }) {
  const [state, formAction] = useForm(saveFeedback);
  const v = state.values;
  const g = (k: keyof FeedbackInitial) => v?.[k] ?? (initial[k] as string);
  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-8" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state.error} />
      <FormSection title="Feedback">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Player" name="player_id" defaultValue={g("player_id")} options={[{ value: "", label: "Pick a player" }, ...players]} error={state.fields.player_id} />
          <TextField label="Date" name="given_on" type="date" defaultValue={g("given_on")} error={state.fields.given_on} className={dateField} />
          <SelectField
            label="Category"
            name="category"
            defaultValue={g("category")}
            options={[{ value: "", label: "Pick a category" }, ...SKILL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
            error={state.fields.category}
          />
          <SelectField label="From match (optional)" name="match_id" defaultValue={g("match_id")} options={[{ value: "", label: "None" }, ...matches]} />
          <SelectField label="From practice (optional)" name="practice_session_id" defaultValue={g("practice_session_id")} options={[{ value: "", label: "None" }, ...sessions]} />
          <SelectField label="Status" name="status" defaultValue={g("status")} options={FEEDBACK_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
        </div>
      </FormSection>
      <FormSection title="Assessment" description="Private: only this player and the staff can read it.">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextAreaField label="Strengths" name="strengths" defaultValue={g("strengths")} maxLength={4000} />
          <TextAreaField label="Areas to improve" name="areas_to_improve" defaultValue={g("areas_to_improve")} maxLength={4000} error={state.fields.areas_to_improve} />
          <TextAreaField label="Specific example or mistake" name="specific_example" defaultValue={g("specific_example")} maxLength={4000} />
          <TextAreaField label="Evidence" name="evidence" defaultValue={g("evidence")} maxLength={4000} hint="Round numbers, timestamps, stats." />
          <TextAreaField label="Improvement action" name="improvement_action" defaultValue={g("improvement_action")} maxLength={4000} className="lg:col-span-2" />
          <TextField label="VOD clip link" name="vod_clip_url" type="url" defaultValue={g("vod_clip_url")} placeholder="https://…" error={state.fields.vod_clip_url} />
          <TextField label="Follow-up date" name="follow_up_on" type="date" defaultValue={g("follow_up_on")} className={dateField} />
        </div>
      </FormSection>
      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving…">{initial.id ? "Save feedback" : "Add feedback"}</SubmitButton>
      </div>
    </form>
  );
}

export type GoalInitial = {
  id?: string;
  player_id: string;
  description: string;
  current_level: string;
  target: string;
  deadline: string;
  progress: number;
  status: string;
  comments: string;
};

export function GoalForm({ initial, players }: { initial: GoalInitial; players: Opt[] }) {
  const [state, formAction] = useForm(saveGoal);
  const v = state.values;
  const [progress, setProgress] = useState(Number(v?.progress ?? initial.progress));
  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Player" name="player_id" defaultValue={v?.player_id ?? initial.player_id} options={[{ value: "", label: "Pick a player" }, ...players]} error={state.fields.player_id} />
        <SelectField label="Status" name="status" defaultValue={v?.status ?? initial.status} options={GOAL_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
        <TextField label="Goal" name="description" defaultValue={v?.description ?? initial.description} maxLength={300} error={state.fields.description} className="sm:col-span-2" placeholder="e.g. Raise first-kill success as entry" />
        <TextField label="Current level" name="current_level" defaultValue={v?.current_level ?? initial.current_level} maxLength={200} placeholder="e.g. 45% FK success" />
        <TextField label="Target" name="target" defaultValue={v?.target ?? initial.target} maxLength={200} placeholder="e.g. 55% by March" />
        <TextField label="Deadline" name="deadline" type="date" defaultValue={v?.deadline ?? initial.deadline} className={dateField} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-progress" className="text-[13px] font-medium text-fog">
            Progress <span className="num ml-1 text-[16px] text-bone">{progress}%</span>
          </label>
          <input id="f-progress" type="range" name="progress" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="h-[42px] accent-[var(--accent)]" />
          {state.fields.progress ? <p className="text-[13px] text-loss">{state.fields.progress}</p> : <p className="text-[13px] text-dim">Every change is kept, so you can see the evolution week by week.</p>}
        </div>
        <TextAreaField label="Comments" name="comments" defaultValue={v?.comments ?? initial.comments} maxLength={4000} className="sm:col-span-2" />
      </div>
      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving…">{initial.id ? "Save goal" : "Add goal"}</SubmitButton>
      </div>
    </form>
  );
}

export type ObjectiveInitial = { id?: string; title: string; details: string; kind: string; progress: number; status: string; due_on: string };

export function ObjectiveForm({ initial }: { initial: ObjectiveInitial }) {
  const [state, formAction] = useForm(saveObjective);
  const v = state.values;
  const [progress, setProgress] = useState(Number(v?.progress ?? initial.progress));
  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Objective" name="title" defaultValue={v?.title ?? initial.title} maxLength={200} error={state.fields.title} className="sm:col-span-2" />
        <SelectField
          label="Type"
          name="kind"
          defaultValue={v?.kind ?? initial.kind}
          options={[
            { value: "objective", label: "Team objective (with progress)" },
            { value: "priority", label: "Staff priority" },
          ]}
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={v?.status ?? initial.status}
          options={[
            { value: "active", label: "Active" },
            { value: "done", label: "Done" },
            { value: "dropped", label: "Dropped" },
          ]}
        />
        <TextField label="Due date" name="due_on" type="date" defaultValue={v?.due_on ?? initial.due_on} className={dateField} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-oprogress" className="text-[13px] font-medium text-fog">
            Progress <span className="num ml-1 text-[16px] text-bone">{progress}%</span>
          </label>
          <input id="f-oprogress" type="range" name="progress" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="h-[42px] accent-[var(--accent)]" />
        </div>
        <TextAreaField label="Details" name="details" defaultValue={v?.details ?? initial.details} maxLength={4000} className="sm:col-span-2" />
      </div>
      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving…">{initial.id ? "Save objective" : "Add objective"}</SubmitButton>
      </div>
    </form>
  );
}
