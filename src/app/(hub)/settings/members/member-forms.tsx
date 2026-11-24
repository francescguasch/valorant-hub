"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { FormAlert, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { useForm } from "@/lib/use-form";
import {
  createInvitation,
  createResetCode,
  removeMember,
  revokeInvitation,
  setMemberAccess,
  updateMember,
} from "../actions";

type Role = "owner" | "coach" | "player";
type PlayerOpt = { id: string; nickname: string };

function CopyBox({ value, label, small }: { value: string; label: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border border-accent/50 bg-accent/[0.07] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[12.5px] text-fog">{label}</p>
        <p className={small ? "select-all break-all text-[14px] text-bone" : "select-all break-all font-display text-[22px] font-bold tracking-[0.12em] text-bone"}>{value}</p>
      </div>
      <button
        type="button"
        className={buttonClass("ghost", "shrink-0")}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? <Check className="size-4 text-win" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function InviteForm({ players, canInviteStaff, origin }: { players: PlayerOpt[]; canInviteStaff: boolean; origin: string }) {
  const [state, formAction] = useForm(createInvitation);
  const [role, setRole] = useState<Role>("player");
  return (
    <div className="flex flex-col gap-4">
      {state.reveal ? (
        <div className="flex flex-col gap-2">
          <FormAlert success={state.success} />
          <CopyBox label="Invitation code" value={state.reveal} />
          <CopyBox label="Or share this link" value={`${origin}/join?code=${state.reveal}`} small />
        </div>
      ) : (
        <FormAlert error={state.error} />
      )}
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <SelectField
          label="Role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          options={[
            { value: "player", label: "Player" },
            ...(canInviteStaff
              ? [
                  { value: "coach", label: "Coach / staff" },
                  { value: "owner", label: "Owner (full access)" },
                ]
              : []),
          ]}
          hint={canInviteStaff ? undefined : "Coaches can invite players. Ask the owner to invite staff."}
        />
        {role === "player" ? (
          <SelectField
            label="Roster player"
            name="player_id"
            defaultValue=""
            hint="Links the account to the player profile so they see their own feedback."
            options={[{ value: "", label: "Not linked yet" }, ...players.map((p) => ({ value: p.id, label: p.nickname }))]}
          />
        ) : (
          <input type="hidden" name="player_id" value="" />
        )}
        <TextField label="Email (optional)" name="email" type="email" defaultValue={state.values?.email} hint="If set, only this email can use the code." error={state.fields.email} />
        <TextField label="Note (optional)" name="note" defaultValue={state.values?.note} maxLength={80} placeholder="e.g. Assistant coach" error={state.fields.note} />
        <SelectField
          label="Valid for"
          name="days"
          defaultValue="7"
          options={[
            { value: "1", label: "1 day" },
            { value: "3", label: "3 days" },
            { value: "7", label: "7 days" },
            { value: "14", label: "14 days" },
            { value: "30", label: "30 days" },
          ]}
        />
        <SubmitButton pendingLabel="Creating…">Create invitation code</SubmitButton>
      </form>
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  return (
    <form action={revokeInvitation}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" pendingLabel="Revoking…">
        Revoke
      </SubmitButton>
    </form>
  );
}

type MemberInfo = { id: string; role: Role; player_id: string | null; disabled: boolean; isSelf: boolean };

export function MemberActions({
  member,
  players,
  canManage,
  canReset,
}: {
  member: MemberInfo;
  players: PlayerOpt[];
  canManage: boolean;
  canReset: boolean;
}) {
  const [editState, editAction] = useForm(updateMember);
  const [resetState, resetAction] = useForm(createResetCode);
  return (
    <div className="flex flex-col gap-3 lg:max-w-[460px] lg:items-end">
      {canManage ? (
        <form action={editAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={member.id} />
          <SelectField
            label="Role"
            name="role"
            defaultValue={member.role}
            className="w-36"
            options={[
              { value: "owner", label: "Owner" },
              { value: "coach", label: "Coach / staff" },
              { value: "player", label: "Player" },
            ]}
          />
          <SelectField
            label="Roster player"
            name="player_id"
            defaultValue={member.player_id ?? ""}
            className="w-40"
            options={[{ value: "", label: "None" }, ...players.map((p) => ({ value: p.id, label: p.nickname }))]}
          />
          <SubmitButton variant="secondary" pendingLabel="Saving…" className="h-[42px]">
            Save
          </SubmitButton>
        </form>
      ) : null}
      <FormAlert error={editState.error} success={editState.success} />

      <div className="flex flex-wrap items-start gap-2 lg:justify-end">
        {canReset ? (
          <form action={resetAction}>
            <input type="hidden" name="id" value={member.id} />
            <SubmitButton variant="ghost" pendingLabel="Creating…">
              <KeyRound className="size-4" aria-hidden /> Reset code
            </SubmitButton>
          </form>
        ) : null}
        {canManage && !member.isSelf ? (
          <>
            <ConfirmAction
              action={setMemberAccess}
              hidden={{ id: member.id, disable: String(!member.disabled) }}
              label={member.disabled ? "Restore access" : "Block access"}
              confirmLabel={member.disabled ? "Restore" : "Block"}
              question={member.disabled ? "Let them sign in again?" : "Sign them out and block access?"}
              variant={member.disabled ? "secondary" : "danger"}
            />
            <ConfirmAction
              action={removeMember}
              hidden={{ id: member.id }}
              label="Remove"
              confirmLabel="Remove member"
              question="Delete this account? This can't be undone."
            />
          </>
        ) : null}
      </div>
      {resetState.reveal ? (
        <div className="w-full">
          <CopyBox label="Reset code (share privately, valid 24 h)" value={resetState.reveal} />
        </div>
      ) : (
        <FormAlert error={resetState.error} />
      )}
    </div>
  );
}
