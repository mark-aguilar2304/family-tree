import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { signUpAction } from "@/lib/actions/auth";
import { safeNextPath } from "@/lib/navigation";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const user = await getCurrentUser();
  if (user) redirect(next);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
        Begin a family record
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Accounts are personal. Family workspaces are shared only by invitation.
      </p>

      <ActionForm
        action={signUpAction}
        submitLabel="Create account"
        pendingLabel="Creating account…"
        className="mt-6 space-y-4"
      >
        <input type="hidden" name="next" value={next} />
        <Field label="Full name" htmlFor="fullName" required>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            maxLength={120}
            placeholder="María Rivera"
          />
        </Field>
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
        <Field
          label="Password"
          htmlFor="password"
          required
          hint="At least 8 characters."
        >
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

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={next === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
