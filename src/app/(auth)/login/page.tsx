import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { signInAction } from "@/lib/actions/auth";
import { safeNextPath } from "@/lib/navigation";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const user = await getCurrentUser();
  if (user) redirect(next);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
        Welcome back
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Sign in to Kinship</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Continue to your family workspaces.
      </p>

      {params.error && (
        <Alert variant="destructive" className="mt-5" role="alert">
          <AlertCircle />
          <AlertDescription>
            That sign-in link is invalid or has expired. Try signing in, or
            request a new link.
          </AlertDescription>
        </Alert>
      )}

      <ActionForm
        action={signInAction}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        className="mt-6 space-y-4"
      >
        <input type="hidden" name="next" value={next} />
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
        <Field label="Password" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
        </Field>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </ActionForm>

      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={next === "/dashboard" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
