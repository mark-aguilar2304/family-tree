"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, friendlyError, type ActionState } from "@/lib/errors";
import {
  datePrecisionSchema,
  guardianshipSchema,
  parentageSchema,
  partnershipSchema,
  partnershipStatusSchema,
  validPartialDate,
} from "@/lib/validation";
import type { DatePrecision } from "@/lib/supabase/database.types";

function dateValue(value: string, precision: DatePrecision): string | null {
  return precision === "unknown" || !value ? null : value;
}

function refresh(familyId: string, personIds: string[]) {
  revalidatePath(`/families/${familyId}/tree`);
  revalidatePath(`/families/${familyId}/people`);
  for (const personId of new Set(personIds)) {
    revalidatePath(`/families/${familyId}/people/${personId}`);
  }
}

export async function createParentageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parentageSchema.safeParse({
    familyId: formData.get("familyId"),
    personId: formData.get("personId"),
    relativeId: formData.get("relativeId"),
    mode: formData.get("mode"),
    parentageType: formData.get("parentageType"),
    startDate: formData.get("startDate"),
    startDatePrecision: formData.get("startDatePrecision") ?? "unknown",
    endDate: formData.get("endDate"),
    endDatePrecision: formData.get("endDatePrecision") ?? "unknown",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionError("Check the relationship details.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const access = await requireFamily(data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to add relationships.");

  const supabase = await createClient();
  const { error } = await supabase.from("parent_child_relationships").insert({
    family_id: data.familyId,
    parent_id: data.mode === "parent" ? data.relativeId : data.personId,
    child_id: data.mode === "parent" ? data.personId : data.relativeId,
    parentage_type: data.parentageType,
    start_date: dateValue(data.startDate, data.startDatePrecision),
    start_date_precision: data.startDatePrecision,
    end_date: dateValue(data.endDate, data.endDatePrecision),
    end_date_precision: data.endDatePrecision,
    notes: data.notes || null,
    created_by: access.membership.user_id,
  });
  if (error) return actionError(friendlyError(error));

  refresh(data.familyId, [data.personId, data.relativeId]);
  return actionSuccess("Parentage relationship added.");
}

export async function createPartnershipAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = partnershipSchema.safeParse({
    familyId: formData.get("familyId"),
    personId: formData.get("personId"),
    partnerId: formData.get("partnerId"),
    partnershipType: formData.get("partnershipType"),
    status: formData.get("status"),
    startDate: formData.get("startDate"),
    startDatePrecision: formData.get("startDatePrecision") ?? "unknown",
    endDate: formData.get("endDate"),
    endDatePrecision: formData.get("endDatePrecision") ?? "unknown",
    location: formData.get("location"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionError("Check the partnership details.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const access = await requireFamily(data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to add relationships.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_partnership", {
    p_family_id: data.familyId,
    p_participant_ids: [data.personId, data.partnerId],
    p_partnership_type: data.partnershipType,
    p_status: data.status,
    p_start_date: dateValue(data.startDate, data.startDatePrecision),
    p_start_date_precision: data.startDatePrecision,
    p_end_date: dateValue(data.endDate, data.endDatePrecision),
    p_end_date_precision: data.endDatePrecision,
    p_location: data.location || null,
    p_notes: data.notes || null,
  });
  if (error) return actionError(friendlyError(error));

  refresh(data.familyId, [data.personId, data.partnerId]);
  return actionSuccess("Partnership added.");
}

export async function createGuardianshipAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = guardianshipSchema.safeParse({
    familyId: formData.get("familyId"),
    personId: formData.get("personId"),
    relativeId: formData.get("relativeId"),
    direction: formData.get("direction"),
    guardianshipType: formData.get("guardianshipType"),
    startDate: formData.get("startDate"),
    startDatePrecision: formData.get("startDatePrecision") ?? "unknown",
    endDate: formData.get("endDate"),
    endDatePrecision: formData.get("endDatePrecision") ?? "unknown",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionError("Check the guardianship details.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const access = await requireFamily(data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to add relationships.");

  const supabase = await createClient();
  const { error } = await supabase.from("guardianships").insert({
    family_id: data.familyId,
    guardian_id: data.direction === "guardian" ? data.personId : data.relativeId,
    ward_id: data.direction === "guardian" ? data.relativeId : data.personId,
    guardianship_type: data.guardianshipType,
    start_date: dateValue(data.startDate, data.startDatePrecision),
    start_date_precision: data.startDatePrecision,
    end_date: dateValue(data.endDate, data.endDatePrecision),
    end_date_precision: data.endDatePrecision,
    notes: data.notes || null,
    created_by: access.membership.user_id,
  });
  if (error) return actionError(friendlyError(error));

  refresh(data.familyId, [data.personId, data.relativeId]);
  return actionSuccess("Guardianship added.");
}

const endSchema = z.object({
  familyId: z.uuid(),
  recordId: z.uuid(),
  personId: z.uuid(),
  endDate: z.string().trim().min(1, "Enter an end date.").max(10),
  endDatePrecision: datePrecisionSchema,
});

function endInput(formData: FormData) {
  return endSchema.safeParse({
    familyId: formData.get("familyId"),
    recordId: formData.get("recordId"),
    personId: formData.get("personId"),
    endDate: formData.get("endDate"),
    endDatePrecision: formData.get("endDatePrecision") ?? "year",
  });
}

export async function endParentageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = endInput(formData);
  if (!parsed.success) {
    return actionError("Check the end date.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  if (!validPartialDate(data.endDate, data.endDatePrecision)) {
    return actionError("Use a date that matches the selected precision.");
  }
  const access = await requireFamily(data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to edit relationships.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("parent_child_relationships")
    .update({
      end_date: data.endDate,
      end_date_precision: data.endDatePrecision,
    })
    .eq("id", data.recordId)
    .eq("family_id", data.familyId);
  if (error) return actionError(friendlyError(error));

  refresh(data.familyId, [data.personId]);
  return actionSuccess("Parentage record ended. Its history is preserved.");
}

export async function updatePartnershipStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      familyId: z.uuid(),
      partnershipId: z.uuid(),
      personId: z.uuid(),
      status: partnershipStatusSchema,
      endDate: z.string().trim().max(10).optional().transform((value) => value || ""),
      endDatePrecision: datePrecisionSchema,
    })
    .safeParse({
      familyId: formData.get("familyId"),
      partnershipId: formData.get("partnershipId"),
      personId: formData.get("personId"),
      status: formData.get("status"),
      endDate: formData.get("endDate"),
      endDatePrecision: formData.get("endDatePrecision") ?? "unknown",
    });
  if (!parsed.success) {
    return actionError("Check the partnership details.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  if (!validPartialDate(data.endDate, data.endDatePrecision)) {
    return actionError("Use an end date that matches the selected precision.");
  }
  if (data.status === "current" && data.endDate) {
    return actionError("A current partnership cannot have an end date.");
  }
  if (data.status !== "current" && !data.endDate) {
    return actionError("Add an end date when the partnership is no longer current.");
  }
  const access = await requireFamily(data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to edit relationships.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("partnerships")
    .update({
      status: data.status,
      end_date: dateValue(data.endDate, data.endDatePrecision),
      end_date_precision: data.endDatePrecision,
    })
    .eq("id", data.partnershipId)
    .eq("family_id", data.familyId);
  if (error) return actionError(friendlyError(error));

  refresh(data.familyId, [data.personId]);
  return actionSuccess("Partnership updated.");
}

export async function endGuardianshipAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = endInput(formData);
  if (!parsed.success) {
    return actionError("Check the end date.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  if (!validPartialDate(data.endDate, data.endDatePrecision)) {
    return actionError("Use a date that matches the selected precision.");
  }
  const access = await requireFamily(data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to edit relationships.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("guardianships")
    .update({
      end_date: data.endDate,
      end_date_precision: data.endDatePrecision,
    })
    .eq("id", data.recordId)
    .eq("family_id", data.familyId);
  if (error) return actionError(friendlyError(error));

  refresh(data.familyId, [data.personId]);
  return actionSuccess("Guardianship ended. Its history is preserved.");
}
