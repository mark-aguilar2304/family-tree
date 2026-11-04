"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireFamily, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, friendlyError, type ActionState } from "@/lib/errors";
import { invitationSchema } from "@/lib/validation";
import { getAppUrl } from "@/lib/url";
import { sendInvitationEmail } from "@/lib/email";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvitationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = invitationSchema.safeParse({
    familyId: formData.get("familyId"),
    email: formData.get("email"),
    role: formData.get("role"),
    expiresInDays: formData.get("expiresInDays") ?? 7,
  });
  if (!parsed.success) {
    return actionError("Check the invitation details.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const access = await requireFamily(data.familyId);
  if (!access.canManage) return actionError("You do not have permission to invite members.");
  if (access.role === "admin" && data.role === "admin") {
    return actionError("Admins cannot invite another admin.");
  }

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    p_key: `invite:${data.familyId}`,
    p_limit: 20,
    p_window_seconds: 3600,
  });
  if (!allowed) return actionError("Too many invitations. Try again later.");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString();
  const { error } = await supabase.rpc("create_invitation", {
    p_family_id: data.familyId,
    p_email: data.email,
    p_role: data.role,
    p_token_hash: hashToken(token),
    p_expires_at: expiresAt,
  });
  if (error) return actionError(friendlyError(error));

  const origin = await getAppUrl();
  const inviteUrl = `${origin}/invite/${token}`;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", access.membership.user_id)
    .maybeSingle();
  const delivery = await sendInvitationEmail({
    to: data.email,
    familyName: access.family.name,
    inviterName: profile?.full_name || "A family member",
    inviteUrl,
    expiresInDays: data.expiresInDays,
  });

  revalidatePath(`/families/${data.familyId}/members`);
  const message =
    delivery === "sent"
      ? "Invitation created and emailed."
      : delivery === "failed"
        ? "Invitation created, but email delivery failed. Copy the secure link below."
        : "Invitation created. Email delivery is not configured, so copy the secure link below.";

  return {
    status: "success",
    message,
    data: { inviteUrl, email: data.email, delivery },
  };
}

export async function revokeInvitationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ familyId: z.uuid(), invitationId: z.uuid() })
    .safeParse({
      familyId: formData.get("familyId"),
      invitationId: formData.get("invitationId"),
    });
  if (!parsed.success) return actionError("Invalid invitation.");
  const access = await requireFamily(parsed.data.familyId);
  if (!access.canManage) return actionError("You do not have permission to revoke invitations.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", {
    p_invitation_id: parsed.data.invitationId,
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}/members`);
  return actionSuccess("Invitation revoked.");
}

export async function acceptInvitationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = z.string().min(20).max(200).safeParse(formData.get("token"));
  if (!token.success) return actionError("This invitation link is not valid.");
  await requireUser();

  const supabase = await createClient();
  const { data: familyId, error } = await supabase.rpc("accept_invitation", {
    p_token: token.data,
  });
  if (error || !familyId) return actionError(friendlyError(error));

  revalidatePath("/dashboard");
  revalidatePath(`/families/${familyId}`, "layout");
  redirect(`/families/${familyId}`);
}
