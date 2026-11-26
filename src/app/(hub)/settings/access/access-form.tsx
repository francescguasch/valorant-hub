"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { useForm } from "@/lib/use-form";
import { updateAccess } from "../actions";

type Item = { key: string; label: string; blurb: string; risk: string | null };

export function AccessForm({
  enabled,
  selected,
  realNames,
  sections,
}: {
  enabled: boolean;
  selected: string[];
  realNames: boolean;
  sections: Item[];
}) {
  const [state, formAction] = useForm(updateAccess);
  const [on, setOn] = useState(enabled);
  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      <FormAlert error={state.error} success={state.success} />

      <label className="flex cursor-pointer items-start gap-4 border border-line bg-panel p-5">
        <input
          type="checkbox"
          name="public_view_enabled"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-1 size-5 accent-[var(--accent)]"
        />
        <span>
          <span className="block font-semibold text-bone">Let visitors without an account view the hub</span>
          <span className="mt-1 block text-[14px] text-fog">
            Anyone with the link sees the sections below in read-only mode. They can never add, edit or delete anything.
            Private feedback, coach notes, member emails and Settings are never shown to visitors.
          </span>
        </span>
      </label>

      <fieldset disabled={!on} className="flex flex-col gap-2 disabled:opacity-45">
        <legend className="type-display mb-3 text-[19px] font-bold">Sections visitors can open</legend>
        {sections.map((s) => (
          <label
            key={s.key}
            className="flex cursor-pointer items-start gap-3 border-b border-line py-3 last:border-b-0"
          >
            <input
              type="checkbox"
              name="sections"
              value={s.key}
              defaultChecked={selected.includes(s.key)}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block font-medium text-bone">{s.label}</span>
              <span className="block text-[13.5px] text-fog">{s.blurb}</span>
              {s.risk ? (
                <span className="mt-1 flex items-center gap-1.5 text-[13px] text-demo">
                  <TriangleAlert className="size-3.5" aria-hidden /> {s.risk}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
      {/* Keep the chosen sections when the master switch is off */}
      {!on ? selected.map((s) => <input key={s} type="hidden" name="sections" value={s} />) : null}

      <label className="flex cursor-pointer items-start gap-3 border-t border-line pt-5">
        <input
          type="checkbox"
          name="show_real_names"
          defaultChecked={realNames}
          className="mt-1 size-4 accent-[var(--accent)]"
        />
        <span>
          <span className="block font-medium text-bone">Show players&apos; real names to visitors</span>
          <span className="block text-[13.5px] text-fog">
            The name under each nickname in Roster. Members always see it.
          </span>
        </span>
      </label>

      <div>
        <SubmitButton>Save visitor access</SubmitButton>
      </div>
    </form>
  );
}
