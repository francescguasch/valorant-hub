"use client";

import { useState } from "react";
import { FormAlert, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { useForm } from "@/lib/use-form";
import { SESSION_TYPES } from "@/lib/constants";
import { saveSession } from "./actions";

export type SessionInitial = {
  id?: string;
  day: string;
  time: string;
  duration_min: number;
  session_type: string;
  map_id: string;
  strategy_id: string;
  objective: string;
  attending: string[];
  status: string;
  outcome: string;
  coach_notes: string;
  next_steps: string;
};

export function SessionForm({
  initial,
  maps,
  strategies,
  players,
  tzLabel,
}: {
  initial: SessionInitial;
  maps: { id: string; name: string }[];
  strategies: { id: string; name: string; map_id: string; side: string }[];
  players: { id: string; nickname: string }[];
  tzLabel: string;
}) {
  const [state, formAction] = useForm(saveSession);
  const v = state.values;
  const [mapId, setMapId] = useState(v?.map_id ?? initial.map_id);
  const [status, setStatus] = useState(v?.status ?? initial.status);
  const mapStrategies = strategies.filter((s) => s.map_id === mapId);
  const types = SESSION_TYPES.includes(initial.session_type as (typeof SESSION_TYPES)[number]) || !initial.session_type ? SESSION_TYPES : [initial.session_type, ...SESSION_TYPES];

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-8" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state.error} />
      <FormSection title="When">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Date" name="day" type="date" defaultValue={v?.day ?? initial.day} error={state.fields.day} className="[&_input]:[color-scheme:dark]" />
          <TextField label={`Start time (${tzLabel})`} name="time" type="time" defaultValue={v?.time ?? initial.time} error={state.fields.time} className="[&_input]:[color-scheme:dark]" />
          <TextField label="Duration (minutes)" name="duration_min" type="number" min={15} max={720} step={15} defaultValue={v?.duration_min ?? String(initial.duration_min)} error={state.fields.duration_min} />
        </div>
      </FormSection>
      <FormSection title="Plan">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Session type" name="session_type" defaultValue={v?.session_type ?? initial.session_type} options={types.map((t) => ({ value: t, label: t }))} error={state.fields.session_type} />
          <SelectField label="Map" name="map_id" value={mapId} onChange={(e) => setMapId(e.target.value)} options={[{ value: "", label: "No specific map" }, ...maps.map((m) => ({ value: m.id, label: m.name }))]} />
          <SelectField
            key={mapId}
            label="Strategy to practice"
            name="strategy_id"
            defaultValue={mapStrategies.some((s) => s.id === initial.strategy_id) ? initial.strategy_id : ""}
            options={[{ value: "", label: mapId ? (mapStrategies.length ? "None" : "No strategies on this map yet") : "Pick a map first" }, ...mapStrategies.map((s) => ({ value: s.id, label: `${s.side.toUpperCase()} · ${s.name}` }))]}
          />
          <TextAreaField label="Objective" name="objective" defaultValue={v?.objective ?? initial.objective} rows={3} maxLength={4000} className="sm:col-span-3" />
        </div>
        <fieldset className="mt-5">
          <legend className="mb-2 text-[13px] font-medium text-fog">Players attending</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {players.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 text-[14.5px] text-bone">
                <input type="checkbox" name="attending" value={p.id} defaultChecked={initial.attending.includes(p.id)} className="size-4 accent-[var(--accent)]" />
                {p.nickname}
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>
      <FormSection title="Result" description="Fill this in after the session.">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "planned", label: "Planned" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <TextAreaField label="Results" name="outcome" defaultValue={v?.outcome ?? initial.outcome} rows={3} maxLength={4000} className="sm:col-span-3" />
          <TextAreaField label="Coach notes" name="coach_notes" defaultValue={v?.coach_notes ?? initial.coach_notes} rows={3} maxLength={4000} className="sm:col-span-3" />
          <TextAreaField label="Next steps" name="next_steps" defaultValue={v?.next_steps ?? initial.next_steps} rows={3} maxLength={4000} className="sm:col-span-3" />
        </div>
      </FormSection>
      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving…">{initial.id ? "Save session" : "Plan session"}</SubmitButton>
      </div>
    </form>
  );
}
