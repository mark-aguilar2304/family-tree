"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, friendlyError, type ActionState } from "@/lib/errors";
import { safeNextPath } from "@/lib/navigation";
import { getAppUrl } from "@/lib/url";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
});

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

const passwordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
});

function authError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirm your email before signing in.";
  if (/user already registered/i.test(message)) return "An account with that email already exists.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a moment and try again.";
  if (/password/i.test(message)) return message;
  return "Could not complete that request. Please try again.";
}

export async function signInAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return actionError("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return actionError(authError(error.message));

  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signUpAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    return actionError("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const origin = await getAppUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return actionError(authError(error.message));

  if (data.session) redirect(next);

  return actionSuccess(
    "Account created. Check your email for the confirmation link, then sign in.",
  );
}

export async function requestPasswordResetAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return actionError("Enter a valid email address.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const origin = await getAppUrl();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return actionSuccess(
    "If an account exists for that email, a password reset link is on its way.",
  );
}

export async function updatePasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return actionError("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError("Your reset link has expired. Request a new one.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return actionError(authError(error.message));

  return actionSuccess("Password updated. You can now use it to sign in.");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function resendConfirmationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return actionError("Enter a valid email address.");

  const supabase = await createClient();
  const origin = await getAppUrl();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });

  return error
    ? actionError(friendlyError(error))
    : actionSuccess("If that account needs confirmation, a new email is on its way.");
}
