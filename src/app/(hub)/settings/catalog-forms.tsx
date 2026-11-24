"use client";

import type { ReactNode } from "react";
import { CheckboxField, FormAlert, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { ConfirmAction } from "@/components/ui/confirm";
import { useForm } from "@/lib/use-form";
import type { FormState } from "@/lib/forms";
import {
  deleteAgent,
  deleteMap,
  deleteOpponent,
  deleteRole,
  mergeOpponent,
  saveAgent,
  saveMap,
  saveOpponent,
  saveRole,
} from "./catalog-actions";

type Action = (p: FormState, fd: FormData) => Promise<FormState>;

function InlineForm({ action, children, submitLabel = "Save" }: { action: Action; children: ReactNode; submitLabel?: string }) {
  const [state, formAction] = useForm(action);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <SubmitButton variant="secondary" className="h-[42px]">
          {submitLabel}
        </SubmitButton>
      </div>
      <FormAlert error={state.error} success={state.success} />
    </form>
  );
}

const ROLE_OPTIONS = [
  { value: "duelist", label: "Duelist" },
  { value: "initiator", label: "Initiator" },
  { value: "controller", label: "Controller" },
  { value: "sentinel", label: "Sentinel" },
];

// ----------------------------------------------------------------------------- Maps
export function MapEditor({
  map,
}: {
  map: { id: string; name: string; in_rotation: boolean; active: boolean; image_url: string | null; matches: number };
}) {
  return (
    <div className="flex flex-col gap-3">
      <InlineForm action={saveMap}>
        <input type="hidden" name="id" value={map.id} />
        <TextField label="Name" name="name" defaultValue={map.name} className="w-44" required />
        <TextField label="Custom image link (optional)" name="image_url" defaultValue={map.image_url ?? ""} className="min-w-[240px] flex-1" placeholder="https://…" />
        <div className="flex h-[42px] items-center gap-5">
          <CheckboxField label="In competitive pool" name="in_rotation" defaultChecked={map.in_rotation} />
          <CheckboxField label="Show in lists" name="active" defaultChecked={map.active} />
        </div>
      </InlineForm>
      {map.matches === 0 ? (
        <ConfirmAction action={deleteMap} hidden={{ id: map.id }} label="Delete map" confirmLabel="Delete" question={`Delete ${map.name} and its playbook?`} />
      ) : (
        <p className="text-[13px] text-dim">Used in {map.matches} recorded matches, so it can be hidden but not deleted.</p>
      )}
    </div>
  );
}

export function NewMapForm() {
  return (
    <InlineForm action={saveMap} submitLabel="Add map">
      <input type="hidden" name="id" value="" />
      <TextField label="Map name" name="name" className="w-56" required />
      <TextField label="Custom image link (optional)" name="image_url" className="min-w-[240px] flex-1" placeholder="https://…" />
      <div className="flex h-[42px] items-center">
        <CheckboxField label="In competitive pool" name="in_rotation" />
      </div>
    </InlineForm>
  );
}

// ----------------------------------------------------------------------------- Agents
export function AgentEditor({ agent }: { agent: { id: string; name: string; role: string; active: boolean; image_url: string | null; used: boolean } }) {
  return (
    <div className="flex flex-col gap-3">
      <InlineForm action={saveAgent}>
        <input type="hidden" name="id" value={agent.id} />
        <TextField label="Name" name="name" defaultValue={agent.name} className="w-40" required />
        <SelectField label="Role" name="role" defaultValue={agent.role} options={ROLE_OPTIONS} className="w-40" />
        <TextField label="Custom image link (optional)" name="image_url" defaultValue={agent.image_url ?? ""} className="min-w-[220px] flex-1" placeholder="https://…" />
        <div className="flex h-[42px] items-center">
          <CheckboxField label="Available to pick" name="active" defaultChecked={agent.active} />
        </div>
      </InlineForm>
      {!agent.used ? (
        <ConfirmAction action={deleteAgent} hidden={{ id: agent.id }} label="Delete agent" confirmLabel="Delete" question={`Delete ${agent.name}?`} />
      ) : (
        <p className="text-[13px] text-dim">Used in recorded matches: untick &ldquo;Available to pick&rdquo; to hide it instead.</p>
      )}
    </div>
  );
}

export function NewAgentForm() {
  return (
    <InlineForm action={saveAgent} submitLabel="Add agent">
      <input type="hidden" name="id" value="" />
      <TextField label="Agent name" name="name" className="w-48" required />
      <SelectField label="Role" name="role" defaultValue="duelist" options={ROLE_OPTIONS} className="w-40" />
      <TextField label="Custom image link (optional)" name="image_url" className="min-w-[220px] flex-1" placeholder="https://…" />
    </InlineForm>
  );
}

// ----------------------------------------------------------------------------- Roles
export function RoleEditor({ role, players }: { role: { id: string; name: string }; players: number }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <InlineForm action={saveRole}>
        <input type="hidden" name="id" value={role.id} />
        <TextField label="Role name" name="name" defaultValue={role.name} className="w-64" required />
      </InlineForm>
      <ConfirmAction
        action={deleteRole}
        hidden={{ id: role.id }}
        label="Delete"
        confirmLabel="Delete role"
        question={players ? `${players} player(s) use it. Delete anyway?` : `Delete ${role.name}?`}
      />
    </div>
  );
}

export function NewRoleForm() {
  return (
    <InlineForm action={saveRole} submitLabel="Add role">
      <input type="hidden" name="id" value="" />
      <TextField label="New role" name="name" className="w-64" placeholder="e.g. IGL" required />
    </InlineForm>
  );
}

// ----------------------------------------------------------------------------- Opponents
export function OpponentEditor({
  opponent,
  others,
}: {
  opponent: { id: string; name: string; short_name: string | null; logo_url: string | null; matches: number };
  others: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <InlineForm action={saveOpponent}>
        <input type="hidden" name="id" value={opponent.id} />
        <TextField label="Name" name="name" defaultValue={opponent.name} className="min-w-[220px] flex-1" required />
        <TextField label="Short name" name="short_name" defaultValue={opponent.short_name ?? ""} className="w-32" maxLength={12} />
        <TextField label="Logo link (optional)" name="logo_url" defaultValue={opponent.logo_url ?? ""} className="min-w-[200px] flex-1" placeholder="https://…" />
      </InlineForm>
      {others.length ? (
        <InlineForm action={mergeOpponent} submitLabel="Merge">
          <input type="hidden" name="id" value={opponent.id} />
          <SelectField
            label="Duplicate? Merge its matches into"
            name="into"
            defaultValue=""
            className="min-w-[260px]"
            options={[{ value: "", label: "Choose an opponent" }, ...others.map((o) => ({ value: o.id, label: o.name }))]}
          />
        </InlineForm>
      ) : null}
      {opponent.matches === 0 ? (
        <ConfirmAction action={deleteOpponent} hidden={{ id: opponent.id }} label="Delete opponent" confirmLabel="Delete" question={`Delete ${opponent.name}?`} />
      ) : null}
    </div>
  );
}

export function NewOpponentForm() {
  return (
    <InlineForm action={saveOpponent} submitLabel="Add opponent">
      <input type="hidden" name="id" value="" />
      <TextField label="Opponent name" name="name" className="min-w-[240px] flex-1" required />
      <TextField label="Short name" name="short_name" className="w-32" maxLength={12} />
      <input type="hidden" name="logo_url" value="" />
    </InlineForm>
  );
}
