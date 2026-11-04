"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, friendlyError, type ActionState } from "@/lib/errors";
import { nameSchema, personSchema } from "@/lib/validation";
import type { DatePrecision } from "@/lib/supabase/database.types";

function personInput(formData: FormData) {
  return personSchema.safeParse({
    displayName: formData.get("displayName"),
    givenName: formData.get("givenName"),
    middleName: formData.get("middleName"),
    surname: formData.get("surname"),
    suffix: formData.get("suffix"),
    gender: formData.get("gender"),
    biography: formData.get("biography"),
    birthDate: formData.get("birthDate"),
    birthDatePrecision: formData.get("birthDatePrecision") ?? "unknown",
    birthPlace: formData.get("birthPlace"),
    deathDate: formData.get("deathDate"),
    deathDatePrecision: formData.get("deathDatePrecision") ?? "unknown",
    deathPlace: formData.get("deathPlace"),
    lifeStatus: formData.get("lifeStatus") ?? "unknown",
  });
}

function dateValue(value: string, precision: DatePrecision): string | null {
  return precision === "unknown" || !value ? null : value;
}

function toRow(data: z.infer<typeof personSchema>) {
  return {
    display_name: data.displayName,
    given_name: data.givenName,
    middle_name: data.middleName || null,
    surname: data.surname || null,
    suffix: data.suffix || null,
    gender: data.gender || null,
    biography: data.biography || null,
    birth_date: dateValue(data.birthDate, data.birthDatePrecision),
    birth_date_precision: data.birthDatePrecision,
    birth_place: data.birthPlace || null,
    death_date: dateValue(data.deathDate, data.deathDatePrecision),
    death_date_precision: data.deathDatePrecision,
    death_place: data.deathPlace || null,
    life_status: data.lifeStatus,
  };
}

export async function createPersonAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const familyId = z.uuid().safeParse(formData.get("familyId"));
  if (!familyId.success) return actionError("Invalid workspace.");
  const access = await requireFamily(familyId.data);
  if (!access.canEdit) return actionError("You do not have permission to add people.");
  const parsed = personInput(formData);
  if (!parsed.success) {
    return actionError("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data: person, error } = await supabase
    .from("persons")
    .insert({
      family_id: familyId.data,
      ...toRow(parsed.data),
      created_by: access.membership.user_id,
      updated_by: access.membership.user_id,
    })
    .select("id")
    .single();

  if (error || !person) return actionError(friendlyError(error));

  revalidatePath(`/families/${familyId.data}/people`);
  revalidatePath(`/families/${familyId.data}/tree`);
  redirect(`/families/${familyId.data}/people/${person.id}`);
}

export async function updatePersonAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ids = z
    .object({ familyId: z.uuid(), personId: z.uuid(), version: z.coerce.number().int().positive() })
    .safeParse({
      familyId: formData.get("familyId"),
      personId: formData.get("personId"),
      version: formData.get("version"),
    });
  if (!ids.success) return actionError("Invalid person record.");
  const access = await requireFamily(ids.data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to edit people.");
  const parsed = personInput(formData);
  if (!parsed.success) {
    return actionError("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("persons")
    .update({ ...toRow(parsed.data), updated_by: access.membership.user_id })
    .eq("id", ids.data.personId)
    .eq("family_id", ids.data.familyId)
    .eq("version", ids.data.version)
    .select("id");

  if (error) return actionError(friendlyError(error));
  if (!data || data.length === 0) {
    return actionError("Someone else changed this record. Reload the page and try again.");
  }

  revalidatePath(`/families/${ids.data.familyId}/people`);
  revalidatePath(`/families/${ids.data.familyId}/people/${ids.data.personId}`);
  revalidatePath(`/families/${ids.data.familyId}/tree`);
  redirect(`/families/${ids.data.familyId}/people/${ids.data.personId}`);
}

export async function archivePersonAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ familyId: z.uuid(), personId: z.uuid() })
    .safeParse({ familyId: formData.get("familyId"), personId: formData.get("personId") });
  if (!parsed.success) return actionError("Invalid person record.");
  const access = await requireFamily(parsed.data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to archive people.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("persons")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.personId)
    .eq("family_id", parsed.data.familyId)
    .select("id");
  if (error) return actionError(friendlyError(error));
  if (!data?.length) return actionError("That person could not be archived.");

  revalidatePath(`/families/${parsed.data.familyId}/people`);
  revalidatePath(`/families/${parsed.data.familyId}/people/${parsed.data.personId}`);
  revalidatePath(`/families/${parsed.data.familyId}/tree`);
  redirect(`/families/${parsed.data.familyId}/people/${parsed.data.personId}`);
}

export async function restorePersonAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ familyId: z.uuid(), personId: z.uuid() })
    .safeParse({ familyId: formData.get("familyId"), personId: formData.get("personId") });
  if (!parsed.success) return actionError("Invalid person record.");
  const access = await requireFamily(parsed.data.familyId);
  if (!access.canManage) return actionError("Only an owner or admin can restore people.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("persons")
    .update({ archived_at: null })
    .eq("id", parsed.data.personId)
    .eq("family_id", parsed.data.familyId);
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}/people`);
  revalidatePath(`/families/${parsed.data.familyId}/people/${parsed.data.personId}`);
  revalidatePath(`/families/${parsed.data.familyId}/tree`);
  return actionSuccess("Person restored.");
}

export async function addNameAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = nameSchema.safeParse({
    name: formData.get("name"),
    nameType: formData.get("nameType"),
  });
  if (!parsed.success) {
    return actionError("Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const ids = z
    .object({ familyId: z.uuid(), personId: z.uuid() })
    .safeParse({ familyId: formData.get("familyId"), personId: formData.get("personId") });
  if (!ids.success) return actionError("Invalid person record.");
  const access = await requireFamily(ids.data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to edit names.");

  const supabase = await createClient();
  const { error } = await supabase.from("person_names").insert({
    family_id: ids.data.familyId,
    person_id: ids.data.personId,
    name: parsed.data.name,
    name_type: parsed.data.nameType,
  });
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${ids.data.familyId}/people/${ids.data.personId}`);
  return actionSuccess("Alternate name added.");
}

export async function removeNameAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ familyId: z.uuid(), personId: z.uuid(), nameId: z.uuid() })
    .safeParse({
      familyId: formData.get("familyId"),
      personId: formData.get("personId"),
      nameId: formData.get("nameId"),
    });
  if (!parsed.success) return actionError("Invalid name.");
  const access = await requireFamily(parsed.data.familyId);
  if (!access.canEdit) return actionError("You do not have permission to edit names.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("person_names")
    .delete()
    .eq("id", parsed.data.nameId)
    .eq("person_id", parsed.data.personId)
    .eq("family_id", parsed.data.familyId);
  if (error) return actionError(friendlyError(error));

  revalidatePath(`/families/${parsed.data.familyId}/people/${parsed.data.personId}`);
  return actionSuccess("Alternate name removed.");
}
