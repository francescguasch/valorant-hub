"use client";

import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { useForm } from "@/lib/use-form";
import { changePassword, updateProfile } from "../actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, formAction] = useForm(updateProfile);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state.error} success={state.success} />
      <TextField label="Name shown to the team" name="display_name" defaultValue={displayName} maxLength={40} error={state.fields.display_name} />
      <div>
        <SubmitButton variant="secondary">Save name</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useForm(changePassword);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state.error} success={state.success} />
      <TextField label="Current password" name="current" type="password" autoComplete="current-password" error={state.fields.current} />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." error={state.fields.password} />
      <TextField label="Repeat new password" name="confirm" type="password" autoComplete="new-password" error={state.fields.confirm} />
      <div>
        <SubmitButton variant="secondary">Change password</SubmitButton>
      </div>
    </form>
  );
}
