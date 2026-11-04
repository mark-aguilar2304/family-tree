import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { updatePasswordAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div>
        <h1 className="text-3xl font-semibold">Reset link expired</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Open the newest reset link from your email, or request another one.
        </p>
        <Button asChild className="mt-6">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
        Almost there
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use at least 8 characters. You will stay signed in after saving.
      </p>

      <ActionForm
        action={updatePasswordAction}
        submitLabel="Save new password"
        pendingLabel="Saving…"
        className="mt-6 space-y-4"
      >
        <Field label="New password" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
      </ActionForm>
    </div>
  );
}
