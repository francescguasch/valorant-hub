"use client";

import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { AgentPoolPicker, type AgentOpt } from "@/components/roster/agent-pool";
import { useForm } from "@/lib/use-form";
import { changePassword, updateMyPlayer, updateProfile } from "../actions";

export function ProfileForm({
  displayName,
  avatarUrl,
  userId,
  isPlayer,
}: {
  displayName: string;
  avatarUrl: string;
  userId: string;
  isPlayer: boolean;
}) {
  const [state, formAction] = useForm(updateProfile);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state.error} success={state.success} />
      <TextField
        label="Name shown to the team"
        name="display_name"
        defaultValue={state.values?.display_name ?? displayName}
        maxLength={40}
        error={state.fields.display_name}
      />
      <ImageField
        label={isPlayer ? "Photo (also your roster photo)" : "Profile photo"}
        name="avatar_url"
        initial={avatarUrl}
        kind="avatar"
        folder={`people/${userId}`}
        round
        error={state.fields.avatar_url}
      />
      <div>
        <SubmitButton variant="secondary">Save profile</SubmitButton>
      </div>
    </form>
  );
}

export type MyPlayer = {
  nickname: string;
  real_name: string;
  main_agent_ids: string[];
  secondary_agent_ids: string[];
};

export function MyPlayerForm({ player, agents }: { player: MyPlayer; agents: AgentOpt[] }) {
  const [state, formAction] = useForm(updateMyPlayer);
  const v = state.values;
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormAlert error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nickname"
          name="nickname"
          defaultValue={v?.nickname ?? player.nickname}
          required
          maxLength={30}
          error={state.fields.nickname}
        />
        <TextField
          label="Real name"
          name="real_name"
          defaultValue={v?.real_name ?? player.real_name}
          maxLength={80}
          hint="Only team members see it."
        />
      </div>
      <div>
        <p className="mb-1 text-[13px] font-medium text-fog">Agent pool</p>
        <p className="mb-3 text-[13px] text-dim">Tap an agent once for main, twice for secondary, a third time to clear.</p>
        <AgentPoolPicker agents={agents} main={player.main_agent_ids} secondary={player.secondary_agent_ids} />
      </div>
      <div>
        <SubmitButton variant="secondary">Save player profile</SubmitButton>
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
