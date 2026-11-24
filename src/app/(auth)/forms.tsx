"use client";

import Link from "next/link";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import type { FormState } from "@/lib/forms";
import { useForm } from "@/lib/use-form";
import { joinWithInvitation, resetWithCode, setupOwner, signIn } from "./actions";

export function LoginForm({ next, notice }: { next: string; notice?: string | null }) {
  const [state, formAction] = useForm(signIn);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormAlert error={state.error} success={state.error ? null : notice} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fields.email} />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fields.password}
      />
      <SubmitButton pendingLabel="Signing in…" className="mt-2 w-full">
        Sign in
      </SubmitButton>
      <div className="mt-2 flex flex-col gap-2 text-[14px]">
        <Link href="/join" className="text-fog underline-offset-4 hover:text-bone hover:underline">
          Have an invitation code? Create your account
        </Link>
        <Link href="/reset" className="text-fog underline-offset-4 hover:text-bone hover:underline">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}

function AccountFields({ state, passwordLabel = "Password" }: { state: FormState; passwordLabel?: string }) {
  return (
    <>
      <TextField label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fields.email} />
      <TextField
        label="Name shown to the team"
        name="displayName"
        autoComplete="nickname"
        defaultValue={state.values?.displayName}
        required
        maxLength={40}
        hint="Your in-game name works well."
        error={state.fields.displayName}
      />
      <TextField
        label={passwordLabel}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={state.fields.password}
      />
      <TextField
        label="Repeat password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fields.confirm}
      />
    </>
  );
}

export function JoinForm({ code }: { code: string }) {
  const [state, formAction] = useForm(joinWithInvitation);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state.error} />
      <TextField
        label="Invitation code"
        name="code"
        defaultValue={state.values?.code ?? code}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="XXXX-XXXX-XXXX"
        required
        className="[&_input]:font-display [&_input]:text-[18px] [&_input]:tracking-[0.12em]"
        error={state.fields.code}
      />
      <AccountFields state={state} />
      <SubmitButton pendingLabel="Creating account…" className="mt-2 w-full">
        Create account
      </SubmitButton>
      <Link href="/login" className="mt-1 text-[14px] text-fog underline-offset-4 hover:text-bone hover:underline">
        Already have an account? Sign in
      </Link>
    </form>
  );
}

export function ResetForm() {
  const [state, formAction] = useForm(resetWithCode);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state.error} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fields.email} />
      <TextField
        label="Reset code"
        name="code"
        defaultValue={state.values?.code}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="XXXX-XXXX-XXXX"
        required
        className="[&_input]:font-display [&_input]:text-[18px] [&_input]:tracking-[0.12em]"
        error={state.fields.code}
      />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={state.fields.password}
      />
      <TextField
        label="Repeat new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fields.confirm}
      />
      <SubmitButton pendingLabel="Updating…" className="mt-2 w-full">
        Set new password
      </SubmitButton>
      <Link href="/login" className="mt-1 text-[14px] text-fog underline-offset-4 hover:text-bone hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}

export function SetupForm() {
  const [state, formAction] = useForm(setupOwner);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state.error} />
      <TextField
        label="Setup key"
        name="token"
        type="password"
        autoComplete="off"
        required
        hint="The SETUP_TOKEN value you added to the environment variables."
        error={state.fields.token}
      />
      <AccountFields state={state} />
      <SubmitButton pendingLabel="Creating owner…" className="mt-2 w-full">
        Create owner account
      </SubmitButton>
    </form>
  );
}
