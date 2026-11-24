"use client";

import { FormAlert, SubmitButton, TextAreaField } from "@/components/ui/form";
import { useForm } from "@/lib/use-form";
import { saveScoutingNotes } from "./actions";

export function ScoutingNotesForm({ opponentId, notes }: { opponentId: string; notes: string }) {
  const [state, formAction] = useForm(saveScoutingNotes);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="opponent_id" value={opponentId} />
      <FormAlert error={state.error} success={state.success} />
      <TextAreaField
        label="Scouting notes"
        name="notes"
        rows={8}
        defaultValue={state.values?.notes ?? notes}
        hint="Tendencies, favourite setups, key players, what worked against them. Visible to the team."
        maxLength={12000}
      />
      <div>
        <SubmitButton variant="secondary">Save notes</SubmitButton>
      </div>
    </form>
  );
}
