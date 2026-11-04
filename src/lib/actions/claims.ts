"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, friendlyError, type ActionState } from "@/lib/errors";
import { claimSchema } from "@/lib/validation";

export async function requestPersonClaimAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = claimSchema.safeParse({
    familyId: formData.get("familyId"),
    personId: formData.get("personId"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return actionError("Check the claim details.", parsed.error.flatten().fieldErrors);
  }
  await requireFamily(parsed.data.familyId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_person_claim", {
    p_family_id: parsed.data.familyId,
    p_person_id: parsed.data.personId,
    p_message: parsed.data.message || null,
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}/people/${parsed.data.personId}`);
  revalidatePath(`/families/${parsed.data.familyId}/claims`);
  return actionSuccess("Claim requested. An owner or admin will review it.");
}

export async function withdrawPersonClaimAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ familyId: z.uuid(), personId: z.uuid(), claimId: z.uuid() })
    .safeParse({
      familyId: formData.get("familyId"),
      personId: formData.get("personId"),
      claimId: formData.get("claimId"),
    });
  if (!parsed.success) return actionError("Invalid claim.");
  await requireFamily(parsed.data.familyId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_person_claim", {
    p_claim_id: parsed.data.claimId,
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}/people/${parsed.data.personId}`);
  revalidatePath(`/families/${parsed.data.familyId}/claims`);
  return actionSuccess("Claim withdrawn.");
}

export async function resolvePersonClaimAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      familyId: z.uuid(),
      personId: z.uuid(),
      claimId: z.uuid(),
      approve: z.enum(["true", "false"]),
    })
    .safeParse({
      familyId: formData.get("familyId"),
      personId: formData.get("personId"),
      claimId: formData.get("claimId"),
      approve: formData.get("approve"),
    });
  if (!parsed.success) return actionError("Invalid claim.");
  const access = await requireFamily(parsed.data.familyId);
  if (!access.canManage) return actionError("Only an owner or admin can review claims.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_person_claim", {
    p_claim_id: parsed.data.claimId,
    p_approve: parsed.data.approve === "true",
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}/claims`);
  revalidatePath(`/families/${parsed.data.familyId}/people/${parsed.data.personId}`);
  return actionSuccess(
    parsed.data.approve === "true" ? "Claim approved." : "Claim rejected.",
  );
}
