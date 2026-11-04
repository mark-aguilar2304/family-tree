"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireFamily, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, friendlyError, type ActionState } from "@/lib/errors";

const familySchema = z.object({
  familyId: z.uuid().optional(),
  name: z.string().trim().min(1, "Enter a name.").max(120),
  description: z.string().trim().max(2000).optional(),
});

function readFamily(formData: FormData) {
  return familySchema.safeParse({
    familyId: formData.get("familyId") || undefined,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
}

export async function createFamilyAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = readFamily(formData);
  if (!parsed.success) {
    return actionError("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data: familyId, error } = await supabase.rpc("create_family", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
  });
  if (error || !familyId) return actionError(friendlyError(error));

  redirect(`/families/${familyId}`);
}

export async function updateFamilyAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = readFamily(formData);
  if (!parsed.success) {
    return actionError("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  if (!parsed.data.familyId) return actionError("Invalid workspace.");
  const familyId = parsed.data.familyId;
  const access = await requireFamily(familyId);
  if (!access.canManage) return actionError("You do not have permission to edit this workspace.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_family", {
    p_family_id: familyId,
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${familyId}`, "layout");
  return actionSuccess("Workspace details saved.");
}

export async function archiveFamilyAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const familyId = z.uuid().safeParse(formData.get("familyId"));
  if (!familyId.success) return actionError("Invalid workspace.");
  const access = await requireFamily(familyId.data);
  if (!access.isOwner) return actionError("Only the owner can archive this workspace.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_family", { p_family_id: familyId.data });
  if (error) return actionError(friendlyError(error));

  revalidatePath("/dashboard");
  revalidatePath(`/families/${familyId.data}`, "layout");
  redirect(`/families/${familyId.data}`);
}

export async function restoreFamilyAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const familyId = z.uuid().safeParse(formData.get("familyId"));
  if (!familyId.success) return actionError("Invalid workspace.");
  const access = await requireFamily(familyId.data);
  if (!access.isOwner) return actionError("Only the owner can restore this workspace.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_family", { p_family_id: familyId.data });
  if (error) return actionError(friendlyError(error));

  revalidatePath("/dashboard");
  revalidatePath(`/families/${familyId.data}`, "layout");
  return actionSuccess("Workspace restored.");
}

export async function transferOwnershipAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ familyId: z.uuid(), newOwnerId: z.uuid("Choose a member.") })
    .safeParse({
      familyId: formData.get("familyId"),
      newOwnerId: formData.get("newOwnerId"),
    });
  if (!parsed.success) {
    return actionError("Choose a member to become the new owner.", parsed.error.flatten().fieldErrors);
  }
  const access = await requireFamily(parsed.data.familyId);
  if (!access.isOwner) return actionError("Only the owner can transfer ownership.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_ownership", {
    p_family_id: parsed.data.familyId,
    p_new_owner_id: parsed.data.newOwnerId,
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}`, "layout");
  return actionSuccess("Ownership transferred. You are now an admin.");
}

export async function leaveFamilyAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const familyId = z.uuid().safeParse(formData.get("familyId"));
  if (!familyId.success) return actionError("Invalid workspace.");
  const access = await requireFamily(familyId.data);
  if (access.isOwner) return actionError("Transfer ownership before leaving.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_family", { p_family_id: familyId.data });
  if (error) return actionError(friendlyError(error));

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
