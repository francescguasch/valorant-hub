"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { FormAlert, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { useForm } from "@/lib/use-form";
import { scoreOf, validateRounds } from "@/lib/stats/rounds";
import { AGENT_ROLE_LABEL, AGENT_ROLE_ORDER, MATCH_TYPES } from "@/lib/constants";
import { saveMatch } from "./actions";

type AgentOpt = { id: string; name: string; role: string };
type MapOpt = { id: string; name: string; in_rotation: boolean };
type PlayerOpt = { id: string; nickname: string };
type StatInit = {
  agent_id: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  acs: number | null;
  adr: string | null;
  hs_pct: string | null;
  first_kills: number | null;
  first_deaths: number | null;
};

export type MatchInitial = {
  id?: string;
  played_on: string;
  match_type: string;
  competition: string;
  opponent: string;
  series_id: string;
  series_format: string;
  map_number: string;
  map_id: string;
  our_agent_ids: string[];
  opp_agent_ids: string[];
  our_t_rounds: string;
  our_ct_rounds: string;
  opp_t_rounds: string;
  opp_ct_rounds: string;
  our_ot_rounds: string;
  opp_ot_rounds: string;
  pistols_won: string;
  anti_eco_won: string;
  anti_eco_played: string;
  bonus_won: string;
  bonus_played: string;
  first_bloods: string;
  first_blood_wins: string;
  notes: string;
  coach_notes: string;
  vod_url: string;
  stats: Record<string, StatInit>;
};

const RESULT_WORD = { W: "Win", L: "Loss", D: "Draw" } as const;

function AgentPicker({
  prefix,
  label,
  agents,
  initial,
  error,
}: {
  prefix: string;
  label: string;
  agents: AgentOpt[];
  initial: string[];
  error?: string;
}) {
  const [picked, setPicked] = useState<string[]>(() => [0, 1, 2, 3, 4].map((i) => initial[i] ?? ""));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-fog">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {picked.map((value, i) => (
          <select
            key={i}
            name={`${prefix}${i}`}
            aria-label={`${label}, agent ${i + 1}`}
            value={value}
            onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
            className="field"
            aria-invalid={error && !value ? true : undefined}
          >
            <option value="">Agent {i + 1}</option>
            {AGENT_ROLE_ORDER.map((role) => (
              <optgroup key={role} label={AGENT_ROLE_LABEL[role]}>
                {agents
                  .filter((a) => a.role === role)
                  .map((a) => (
                    <option key={a.id} value={a.id} disabled={picked.includes(a.id) && a.id !== value}>
                      {a.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        ))}
      </div>
      {error ? <p className="text-[13px] text-loss">{error}</p> : null}
    </div>
  );
}

function RoundInput({ name, label, value, onChange, max = 12 }: { name: string; label: string; value: string; onChange: (v: string) => void; max?: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-fog">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field num text-center text-[22px] font-semibold"
      />
    </label>
  );
}

export function MatchForm({
  initial,
  agents,
  maps,
  opponents,
  competitions,
  seriesIds,
  players,
}: {
  initial: MatchInitial;
  agents: AgentOpt[];
  maps: MapOpt[];
  opponents: string[];
  competitions: string[];
  seriesIds: string[];
  players: PlayerOpt[];
}) {
  const [state, formAction] = useForm(saveMatch);
  const v = state.values;
  const [type, setType] = useState(v?.match_type ?? initial.match_type);
  const [opponent, setOpponent] = useState(v?.opponent ?? initial.opponent);
  const [r, setR] = useState({
    ourT: v?.our_t_rounds ?? initial.our_t_rounds,
    ourCT: v?.our_ct_rounds ?? initial.our_ct_rounds,
    oppT: v?.opp_t_rounds ?? initial.opp_t_rounds,
    oppCT: v?.opp_ct_rounds ?? initial.opp_ct_rounds,
    ourOT: v?.our_ot_rounds ?? initial.our_ot_rounds,
    oppOT: v?.opp_ot_rounds ?? initial.opp_ot_rounds,
  });
  const set = (k: keyof typeof r) => (val: string) => setR((x) => ({ ...x, [k]: val }));

  const n = (s: string) => (s === "" ? 0 : Number(s));
  const regulationTied = n(r.ourT) + n(r.ourCT) === 12 && n(r.oppT) + n(r.oppCT) === 12;
  const showOT = type !== "scrim" && regulationTied;
  const input = {
    type: type as "scrim" | "official" | "tournament",
    ourT: n(r.ourT),
    ourCT: n(r.ourCT),
    oppT: n(r.oppT),
    oppCT: n(r.oppCT),
    ourOT: showOT ? n(r.ourOT) : 0,
    oppOT: showOT ? n(r.oppOT) : 0,
  };
  const anyRounds = [r.ourT, r.ourCT, r.oppT, r.oppCT].some((x) => x !== "");
  const score = scoreOf(input);
  const problem = anyRounds ? validateRounds(input) : null;
  const newOpponent = opponent.trim().length > 1 && !opponents.some((o) => o.toLowerCase() === opponent.trim().toLowerCase());

  const poolMaps = useMemo(() => maps.filter((m) => m.in_rotation), [maps]);
  const otherMaps = useMemo(() => maps.filter((m) => !m.in_rotation), [maps]);
  const ourAgentIds = initial.our_agent_ids;

  return (
    <form action={formAction} className="flex max-w-5xl flex-col gap-8" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state.error} />

      <FormSection title="Match">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Date" name="played_on" type="date" defaultValue={v?.played_on ?? initial.played_on} required error={state.fields.played_on} className="[&_input]:[color-scheme:dark]" />
          <SelectField
            label="Match type"
            name="match_type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={MATCH_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            error={state.fields.match_type}
          />
          <TextField label="Competition" name="competition" list="competitions" defaultValue={v?.competition ?? initial.competition} placeholder="e.g. Collegiate League" maxLength={80} />
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <TextField
              label="Opponent"
              name="opponent"
              list="opponents"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
              autoComplete="off"
              error={state.fields.opponent}
              hint={newOpponent ? "New opponent: it will be added to Scouting." : "Start typing to reuse an existing opponent."}
            />
          </div>
          <SelectField
            label="Map"
            name="map_id"
            defaultValue={v?.map_id ?? initial.map_id}
            error={state.fields.map_id}
            options={[
              { value: "", label: "Pick a map" },
              ...poolMaps.map((m) => ({ value: m.id, label: `${m.name} · pool` })),
              ...otherMaps.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </div>
        <datalist id="opponents">{opponents.map((o) => <option key={o} value={o} />)}</datalist>
        <datalist id="competitions">{competitions.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="series">{seriesIds.map((c) => <option key={c} value={c} />)}</datalist>
      </FormSection>

      <FormSection title="Series" description="Each map is saved on its own. Give the maps of one BO3 or BO5 the same series id to rebuild the series result.">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Series id" name="series_id" list="series" defaultValue={v?.series_id ?? initial.series_id} placeholder="e.g. CL-W4-GRANITE" maxLength={60} error={state.fields.series_id} />
          <SelectField
            label="Format"
            name="series_format"
            defaultValue={v?.series_format ?? initial.series_format}
            error={state.fields.series_format}
            options={[
              { value: "", label: "Not part of a series" },
              { value: "BO1", label: "BO1" },
              { value: "BO3", label: "BO3" },
              { value: "BO5", label: "BO5" },
            ]}
          />
          <SelectField
            label="Map number"
            name="map_number"
            defaultValue={v?.map_number ?? initial.map_number}
            error={state.fields.map_number}
            options={[{ value: "", label: "—" }, ...[1, 2, 3, 4, 5].map((i) => ({ value: String(i), label: `Map ${i}` }))]}
          />
        </div>
      </FormSection>

      <FormSection title="Compositions">
        <div className="flex flex-col gap-5">
          <AgentPicker prefix="our_agent_" label="Your five agents" agents={agents} initial={initial.our_agent_ids} error={state.fields.our_agents} />
          <AgentPicker prefix="opp_agent_" label="Opponent's five agents" agents={agents} initial={initial.opp_agent_ids} error={state.fields.opp_agents} />
        </div>
      </FormSection>

      <FormSection title="Rounds" description="Rounds won on each side. The score and result are calculated for you.">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <RoundInput name="our_t_rounds" label="Your T rounds" value={r.ourT} onChange={set("ourT")} />
            <RoundInput name="our_ct_rounds" label="Your CT rounds" value={r.ourCT} onChange={set("ourCT")} />
            <RoundInput name="opp_t_rounds" label="Their T rounds" value={r.oppT} onChange={set("oppT")} />
            <RoundInput name="opp_ct_rounds" label="Their CT rounds" value={r.oppCT} onChange={set("oppCT")} />
            {showOT ? (
              <>
                <RoundInput name="our_ot_rounds" label="Your overtime rounds" value={r.ourOT} onChange={set("ourOT")} max={30} />
                <RoundInput name="opp_ot_rounds" label="Their overtime rounds" value={r.oppOT} onChange={set("oppOT")} max={30} />
              </>
            ) : null}
          </div>
          <div
            aria-live="polite"
            className={clsx(
              "flex min-w-[220px] flex-col items-center justify-center border px-6 py-4",
              !anyRounds || problem ? "border-line" : score.result === "W" ? "border-win/60" : score.result === "L" ? "border-loss/60" : "border-draw/60",
            )}
          >
            <p className="num text-[52px] font-semibold leading-none text-bone">
              {anyRounds ? `${score.our}–${score.opp}` : "–"}
            </p>
            <p className="mt-2 text-[14px] text-fog">
              {!anyRounds ? "Enter the rounds" : problem ? "Check the rounds" : `${RESULT_WORD[score.result]} · ${score.diff > 0 ? "+" : ""}${score.diff} rounds`}
            </p>
          </div>
        </div>
        {problem || state.fields.rounds ? <p className="mt-3 text-[14px] text-loss">{state.fields.rounds ?? problem}</p> : null}
        {type === "scrim" ? <p className="mt-3 text-[13px] text-dim">Scrims: play to 13 or all 24 rounds. No overtime.</p> : null}
      </FormSection>

      <FormSection title="Round types (optional)" description="Fill these in when you track them. Analytics only uses matches that have them.">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <SelectField
            label="Pistol rounds won"
            name="pistols_won"
            defaultValue={v?.pistols_won ?? initial.pistols_won}
            options={[{ value: "", label: "Not recorded" }, { value: "0", label: "0 of 2" }, { value: "1", label: "1 of 2" }, { value: "2", label: "2 of 2" }]}
          />
          <TextField label="Anti-eco rounds won" name="anti_eco_won" type="number" min={0} defaultValue={v?.anti_eco_won ?? initial.anti_eco_won} />
          <TextField label="Anti-eco rounds played" name="anti_eco_played" type="number" min={0} defaultValue={v?.anti_eco_played ?? initial.anti_eco_played} />
          <TextField label="Bonus rounds won" name="bonus_won" type="number" min={0} defaultValue={v?.bonus_won ?? initial.bonus_won} />
          <TextField label="Bonus rounds played" name="bonus_played" type="number" min={0} defaultValue={v?.bonus_played ?? initial.bonus_played} />
          <TextField label="Rounds with your first blood" name="first_bloods" type="number" min={0} defaultValue={v?.first_bloods ?? initial.first_bloods} />
          <TextField label="…of those, rounds won" name="first_blood_wins" type="number" min={0} defaultValue={v?.first_blood_wins ?? initial.first_blood_wins} />
        </div>
        {state.fields.metrics ? <p className="mt-3 text-[14px] text-loss">{state.fields.metrics}</p> : null}
      </FormSection>

      <FormSection title="Player scoreboard (optional)" description="Copy it from the in-game scoreboard. Tick the players who played this map.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[14px]">
            <thead className="text-[12.5px] text-fog">
              <tr>
                <th className="py-2 pr-3 font-medium">Player</th>
                <th className="py-2 pr-3 font-medium">Agent</th>
                {["K", "D", "A", "ACS", "ADR", "HS%", "FK", "FD"].map((h) => (
                  <th key={h} className="w-[72px] py-2 pr-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const s = initial.stats[p.id];
                const g = (k: string, fallback: string | number | null | undefined) => v?.[`ps_${k}_${p.id}`] ?? (fallback == null ? "" : String(fallback));
                return (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2 pr-3">
                      <input type="hidden" name="ps_player" value={p.id} />
                      <label className="flex items-center gap-2 whitespace-nowrap">
                        <input type="checkbox" name={`ps_played_${p.id}`} defaultChecked={v ? v[`ps_played_${p.id}`] === "on" : Boolean(s)} className="size-4 accent-[var(--accent)]" />
                        <span className="font-semibold text-bone">{p.nickname}</span>
                      </label>
                    </td>
                    <td className="py-2 pr-3">
                      <select name={`ps_agent_${p.id}`} defaultValue={g("agent", s?.agent_id)} className="field min-w-[120px] py-2" aria-label={`${p.nickname} agent`}>
                        <option value="">—</option>
                        {agents
                          .slice()
                          .sort((a, b) => Number(ourAgentIds.includes(b.id)) - Number(ourAgentIds.includes(a.id)) || a.name.localeCompare(b.name))
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    {(
                      [
                        ["k", s?.kills],
                        ["d", s?.deaths],
                        ["a", s?.assists],
                        ["acs", s?.acs],
                        ["adr", s?.adr],
                        ["hs", s?.hs_pct],
                        ["fk", s?.first_kills],
                        ["fd", s?.first_deaths],
                      ] as const
                    ).map(([k, val]) => (
                      <td key={k} className="py-2 pr-2">
                        <input
                          name={`ps_${k}_${p.id}`}
                          inputMode="decimal"
                          defaultValue={g(k, val)}
                          className="field num px-2 py-2 text-center"
                          aria-label={`${p.nickname} ${k.toUpperCase()}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {state.fields.stats ? <p className="mt-3 text-[14px] text-loss">{state.fields.stats}</p> : null}
      </FormSection>

      <FormSection title="Notes and video">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextAreaField label="Match notes" name="notes" defaultValue={v?.notes ?? initial.notes} hint="Visible to the whole team." />
          <TextAreaField label="Coach notes" name="coach_notes" defaultValue={v?.coach_notes ?? initial.coach_notes} hint="Visible to staff only." />
          <TextField label="VOD link" name="vod_url" type="url" defaultValue={v?.vod_url ?? initial.vod_url} placeholder="https://youtube.com/…" error={state.fields.vod_url} />
        </div>
      </FormSection>

      <div className="flex gap-3 border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving match…">{initial.id ? "Save changes" : "Save match"}</SubmitButton>
      </div>
    </form>
  );
}
