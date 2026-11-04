import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
        Account recovery
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Enter the email address on your account. We will send a secure reset link
        if it exists.
      </p>

      <ActionForm
        action={requestPasswordResetAction}
        submitLabel="Send reset link"
        pendingLabel="Sending…"
        className="mt-6 space-y-4"
      >
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </Field>
      </ActionForm>

      <p className="mt-6 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
