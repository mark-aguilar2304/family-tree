"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, friendlyError, type ActionState } from "@/lib/errors";
import { familyRoleSchema } from "@/lib/validation";

export async function changeMemberRoleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      familyId: z.uuid(),
      userId: z.uuid(),
      role: familyRoleSchema,
    })
    .safeParse({
      familyId: formData.get("familyId"),
      userId: formData.get("userId"),
      role: formData.get("role"),
    });
  if (!parsed.success) return actionError("Invalid member role.");
  const access = await requireFamily(parsed.data.familyId);
  if (!access.canManage) return actionError("You do not have permission to change roles.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_member_role", {
    p_family_id: parsed.data.familyId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}/members`);
  return actionSuccess("Member role updated.");
}

export async function removeMemberAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ familyId: z.uuid(), userId: z.uuid() })
    .safeParse({ familyId: formData.get("familyId"), userId: formData.get("userId") });
  if (!parsed.success) return actionError("Invalid member.");
  const access = await requireFamily(parsed.data.familyId);
  if (!access.canManage) return actionError("You do not have permission to remove members.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_family_id: parsed.data.familyId,
    p_user_id: parsed.data.userId,
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}/members`);
  return actionSuccess("Member removed from this workspace.");
}
