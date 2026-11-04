import { describe, expect, it } from "vitest";
import {
  claimSchema,
  guardianshipSchema,
  invitationSchema,
  parentageSchema,
  partnershipSchema,
  personSchema,
  validPartialDate,
} from "@/lib/validation";

const ids = {
  family: "11111111-1111-4111-8111-111111111111",
  person: "22222222-2222-4222-8222-222222222222",
  relative: "33333333-3333-4333-8333-333333333333",
};

function personInput(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Ada Lovelace",
    givenName: "Ada",
    middleName: "",
    surname: "Lovelace",
    suffix: "",
    gender: "",
    biography: "",
    birthDate: "1815-12-10",
    birthDatePrecision: "exact",
    birthPlace: "London",
    deathDate: "1852-11-27",
    deathDatePrecision: "exact",
    deathPlace: "London",
    lifeStatus: "deceased",
    ...overrides,
  };
}

function relationshipInput(overrides: Record<string, unknown> = {}) {
  return {
    familyId: ids.family,
    personId: ids.person,
    relativeId: ids.relative,
    startDate: "",
    startDatePrecision: "unknown",
    endDate: "",
    endDatePrecision: "unknown",
    notes: "",
    ...overrides,
  };
}

describe("validPartialDate", () => {
  it("requires the value to match the selected precision", () => {
    expect(validPartialDate("", "unknown")).toBe(true);
    expect(validPartialDate("", "exact")).toBe(false);
    expect(validPartialDate("2024-02-29", "exact")).toBe(true);
    expect(validPartialDate("2024-02", "month")).toBe(true);
    expect(validPartialDate("2024", "year")).toBe(true);
    expect(validPartialDate("2024-02-01", "year")).toBe(false);
    expect(validPartialDate("2024-02", "exact")).toBe(false);
    expect(validPartialDate("2024-02", "unknown")).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(validPartialDate("2023-02-29", "exact")).toBe(false);
    expect(validPartialDate("2024-04-31", "exact")).toBe(false);
    expect(validPartialDate("2024-13-01", "exact")).toBe(false);
    expect(validPartialDate("2024-13", "month")).toBe(false);
    expect(validPartialDate("2023-02-29", "approximate")).toBe(false);
  });

  it("allows partial values for approximate dates", () => {
    expect(validPartialDate("2024", "approximate")).toBe(true);
    expect(validPartialDate("2024-02", "approximate")).toBe(true);
    expect(validPartialDate("2024-02-29", "approximate")).toBe(true);
  });
});

describe("personSchema", () => {
  it("accepts a complete, consistent person", () => {
    expect(personSchema.safeParse(personInput()).success).toBe(true);
  });

  it("requires a display name", () => {
    expect(personSchema.safeParse(personInput({ displayName: "  " })).success).toBe(false);
  });

  it("rejects dates that do not match their precision", () => {
    expect(
      personSchema.safeParse(
        personInput({ birthDate: "1815-12", birthDatePrecision: "exact" }),
      ).success,
    ).toBe(false);
    expect(
      personSchema.safeParse(
        personInput({ birthDate: "1815-12-10", birthDatePrecision: "unknown" }),
      ).success,
    ).toBe(false);
  });

  it("allows an unknown date with an unknown precision", () => {
    expect(
      personSchema.safeParse(
        personInput({ birthDate: "", birthDatePrecision: "unknown" }),
      ).success,
    ).toBe(true);
  });
});

describe("relationship schemas", () => {
  it("rejects self-parentage and impossible dates", () => {
    expect(
      parentageSchema.safeParse(
        relationshipInput({
          relativeId: ids.person,
          parentageType: "biological",
          mode: "parent",
        }),
      ).success,
    ).toBe(false);
    expect(
      parentageSchema.safeParse(
        relationshipInput({
          parentageType: "biological",
          mode: "parent",
          startDate: "2023-02-29",
          startDatePrecision: "exact",
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts valid parentage, partnership, and guardianship", () => {
    expect(
      parentageSchema.safeParse(
        relationshipInput({ parentageType: "adoptive", mode: "parent" }),
      ).success,
    ).toBe(true);
    expect(
      partnershipSchema.safeParse({
        ...relationshipInput({
          partnerId: ids.relative,
          partnershipType: "marriage",
          status: "current",
          location: "",
        }),
      }).success,
    ).toBe(true);
    expect(
      guardianshipSchema.safeParse(
        relationshipInput({ direction: "guardian", guardianshipType: "legal" }),
      ).success,
    ).toBe(true);
  });

  it("rejects self-partnership and self-guardianship", () => {
    expect(
      partnershipSchema.safeParse({
        ...relationshipInput({
          partnerId: ids.person,
          partnershipType: "marriage",
          status: "current",
          location: "",
        }),
      }).success,
    ).toBe(false);
    expect(
      guardianshipSchema.safeParse(
        relationshipInput({
          relativeId: ids.person,
          direction: "guardian",
          guardianshipType: "legal",
        }),
      ).success,
    ).toBe(false);
  });
});

describe("invitationSchema", () => {
  it("normalizes email addresses and rejects owner invitations", () => {
    const parsed = invitationSchema.safeParse({
      familyId: ids.family,
      email: "  Relative@Example.COM ",
      role: "contributor",
      expiresInDays: "7",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.email).toBe("relative@example.com");
    expect(parsed.data?.expiresInDays).toBe(7);
    expect(
      invitationSchema.safeParse({
        familyId: ids.family,
        email: "relative@example.com",
        role: "owner",
        expiresInDays: 7,
      }).success,
    ).toBe(false);
  });
});

describe("claimSchema", () => {
  it("accepts an empty optional message", () => {
    const parsed = claimSchema.safeParse({
      familyId: ids.family,
      personId: ids.person,
      message: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.message).toBe("");
  });
});
