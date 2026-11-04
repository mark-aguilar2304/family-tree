import type {
  Parentage,
  Partnership,
  PartnershipParticipant,
  Person,
} from "@/lib/supabase/database.types";

const timestamp = "2026-01-01T00:00:00.000Z";

export function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    family_id: "family-1",
    given_name: "",
    middle_name: null,
    surname: null,
    suffix: null,
    display_name: id,
    gender: null,
    biography: null,
    birth_date: null,
    birth_date_precision: "unknown",
    birth_place: null,
    death_date: null,
    death_date_precision: "unknown",
    death_place: null,
    life_status: "unknown",
    is_claimed: false,
    created_by: "user-1",
    updated_by: "user-1",
    version: 1,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
    ...overrides,
  };
}

export function makeParentage(
  id: string,
  parentId: string,
  childId: string,
  overrides: Partial<Parentage> = {},
): Parentage {
  return {
    id,
    family_id: "family-1",
    parent_id: parentId,
    child_id: childId,
    parentage_type: "biological",
    start_date: null,
    start_date_precision: "unknown",
    end_date: null,
    end_date_precision: "unknown",
    notes: null,
    created_by: "user-1",
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

export function makePartnership(
  id: string,
  overrides: Partial<Partnership> = {},
): Partnership {
  return {
    id,
    family_id: "family-1",
    partnership_type: "marriage",
    status: "current",
    start_date: null,
    start_date_precision: "unknown",
    end_date: null,
    end_date_precision: "unknown",
    location: null,
    notes: null,
    created_by: "user-1",
    version: 1,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

export function makeParticipant(
  id: string,
  partnershipId: string,
  personId: string,
  createdAt = timestamp,
): PartnershipParticipant {
  return {
    id,
    family_id: "family-1",
    partnership_id: partnershipId,
    person_id: personId,
    participant_role: null,
    created_at: createdAt,
  };
}
