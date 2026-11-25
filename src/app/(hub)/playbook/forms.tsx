"use client";

import { useState } from "react";
import { FormAlert, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { useForm } from "@/lib/use-form";
import { AGENT_ROLE_LABEL, AGENT_ROLE_ORDER, STRATEGY_STATUS, categoriesFor } from "@/lib/constants";
import { saveMapNotes, saveStrategy } from "./actions";

type AgentOpt = { id: string; name: string; role: string };
type Opt = { id: string; name: string };

export type StrategyInitial = {
  id?: string;
  map_id: string;
  side: "t" | "ct";
  category: string;
  name: string;
  status: string;
  description: string;
  objective: string;
  comp_agent_ids: string[];
  assignments: { player_id: string | null; agent_id: string | null; task: string | null }[];
  starting_positions: string;
  utility_usage: string;
  timing: string;
  callouts: string;
  execution: string;
  alternatives: string;
  common_mistakes: string;
  coaching_notes: string;
  youtube_url: string;
};

function AgentSelect({ name, value, agents, label, onChange, taken = [] }: { name: string; value: string; agents: AgentOpt[]; label: string; onChange?: (v: string) => void; taken?: string[] }) {
  return (
    <select name={name} aria-label={label} value={value} onChange={(e) => onChange?.(e.target.value)} className="field">
      <option value="">—</option>
      {AGENT_ROLE_ORDER.map((role) => (
        <optgroup key={role} label={AGENT_ROLE_LABEL[role]}>
          {agents
            .filter((a) => a.role === role)
            .map((a) => (
              <option key={a.id} value={a.id} disabled={taken.includes(a.id) && a.id !== value}>
                {a.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export function StrategyForm({
  initial,
  maps,
  agents,
  players,
}: {
  initial: StrategyInitial;
  maps: Opt[];
  agents: AgentOpt[];
  players: { id: string; nickname: string }[];
}) {
  const [state, formAction] = useForm(saveStrategy);
  const v = state.values;
  const [side, setSide] = useState<"t" | "ct">((v?.side as "t" | "ct") ?? initial.side);
  const [comp, setComp] = useState<string[]>(() => [0, 1, 2, 3, 4].map((i) => initial.comp_agent_ids[i] ?? ""));
  const [assign, setAssign] = useState(() =>
    [0, 1, 2, 3, 4].map((i) => ({
      player: initial.assignments[i]?.player_id ?? "",
      agent: initial.assignments[i]?.agent_id ?? "",
    })),
  );
  const cats = categoriesFor(side);
  const longField = (name: keyof StrategyInitial, label: string, hint?: string, rows = 4) => (
    <TextAreaField label={label} name={name} rows={rows} defaultValue={v?.[name] ?? (initial[name] as string)} hint={hint} maxLength={8000} />
  );

  return (
    <form action={formAction} className="flex max-w-5xl flex-col gap-8" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state.error} />

      <FormSection title="Basics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Strategy name" name="name" defaultValue={v?.name ?? initial.name} required maxLength={80} error={state.fields.name} className="lg:col-span-2" />
          <SelectField label="Status" name="status" defaultValue={v?.status ?? initial.status} options={STRATEGY_STATUS.map((s) => ({ value: s.value, label: s.label }))} error={state.fields.status} />
          <SelectField label="Map" name="map_id" defaultValue={v?.map_id ?? initial.map_id} options={maps.map((m) => ({ value: m.id, label: m.name }))} error={state.fields.map_id} />
          <SelectField
            label="Side"
            name="side"
            value={side}
            onChange={(e) => setSide(e.target.value as "t" | "ct")}
            options={[
              { value: "t", label: "T side (attack)" },
              { value: "ct", label: "CT side (defense)" },
            ]}
            error={state.fields.side}
          />
          <SelectField
            key={side}
            label="Category"
            name="category"
            defaultValue={cats.some((c) => c.value === (v?.category ?? initial.category)) ? (v?.category ?? initial.category) : cats[0]!.value}
            options={cats.map((c) => ({ value: c.value, label: c.label }))}
            error={state.fields.category}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {longField("description", "Description", "What the strategy is, in a few lines.", 3)}
          {longField("objective", "Objective", "What winning the round looks like with this plan.", 3)}
        </div>
      </FormSection>

      <FormSection title="Composition and roles" description="Optional. Leave empty when the plan works with any lineup.">
        <p className="mb-2 text-[13px] font-medium text-fog">Required composition</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {comp.map((value, i) => (
            <AgentSelect
              key={i}
              name={`comp_${i}`}
              label={`Composition agent ${i + 1}`}
              value={value}
              agents={agents}
              taken={comp}
              onChange={(nv) => setComp((c) => c.map((x, j) => (j === i ? nv : x)))}
            />
          ))}
        </div>
        {state.fields.comp ? <p className="mt-2 text-[13px] text-loss">{state.fields.comp}</p> : null}

        <p className="mb-2 mt-6 text-[13px] font-medium text-fog">Player assignments</p>
        <div className="flex flex-col gap-2">
          {assign.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,240px)_minmax(0,240px)]">
              <select
                name={`as_player_${i}`}
                aria-label={`Assignment ${i + 1} player`}
                value={a.player}
                onChange={(e) => setAssign((x) => x.map((y, j) => (j === i ? { ...y, player: e.target.value } : y)))}
                className="field"
              >
                <option value="">Player…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
              <AgentSelect
                name={`as_agent_${i}`}
                label={`Assignment ${i + 1} agent`}
                value={a.agent}
                agents={agents}
                onChange={(nv) => setAssign((x) => x.map((y, j) => (j === i ? { ...y, agent: nv } : y)))}
              />
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection title="Execution">
        <div className="grid gap-4 lg:grid-cols-2">
          {longField("starting_positions", "Starting positions")}
          {longField("utility_usage", "Utility usage")}
          {longField("timing", "Timing", "e.g. Hit at 1:15, plant by 0:50.", 3)}
          {longField("callouts", "Callouts")}
          <div className="lg:col-span-2">{longField("execution", "Round execution, step by step", "One step per line.", 7)}</div>
        </div>
      </FormSection>

      <FormSection title="Video">
        <TextField
          label="YouTube link"
          name="youtube_url"
          type="url"
          defaultValue={v?.youtube_url ?? initial.youtube_url}
          placeholder="https://www.youtube.com/watch?v=…"
          hint="Plays inside the hub. Add &t=90 to start at 1:30."
          error={state.fields.youtube_url}
          className="max-w-2xl"
        />
      </FormSection>

      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving strategy…">{initial.id ? "Save changes" : "Save strategy"}</SubmitButton>
      </div>
    </form>
  );
}

export type NotesInitial = {
  map_id: string;
  overview: string;
  characteristics: string;
  important_areas: string;
  callouts: string;
  strengths: string;
  weaknesses: string;
  recommended_comps: string;
  callouts_image_url: string;
};

export function MapNotesForm({ initial }: { initial: NotesInitial }) {
  const [state, formAction] = useForm(saveMapNotes);
  const v = state.values;
  const f = (name: keyof NotesInitial, label: string, hint?: string) => (
    <TextAreaField label={label} name={name} defaultValue={v?.[name] ?? initial[name]} hint={hint} maxLength={8000} />
  );
  return (
    <form action={formAction} className="flex max-w-5xl flex-col gap-6" noValidate>
      <input type="hidden" name="map_id" value={initial.map_id} />
      <FormAlert error={state.error} />
      <div className="grid gap-4 lg:grid-cols-2">
        {f("overview", "Overview", "How the map plays in a few lines.")}
        {f("characteristics", "Characteristics", "Layout, mechanics, sites.")}
        {f("important_areas", "Important areas")}
        {f("callouts", "Callouts", "Names the team uses, one per line.")}
        {f("strengths", "Team strengths on this map")}
        {f("weaknesses", "Team weaknesses on this map")}
        <div className="lg:col-span-2">{f("recommended_comps", "Recommended compositions")}</div>
      </div>
      <ImageField label="Callouts image (optional)" name="callouts_image_url" initial={initial.callouts_image_url} kind="callouts" wide error={state.fields.callouts_image_url} />
      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving…">Save map notes</SubmitButton>
      </div>
    </form>
  );
}
