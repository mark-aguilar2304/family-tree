import { z } from "zod";
import type { DatePrecision } from "@/lib/supabase/database.types";

export const datePrecisionSchema = z.enum([
  "exact",
  "month",
  "year",
  "approximate",
  "unknown",
]);

export const lifeStatusSchema = z.enum(["living", "deceased", "unknown"]);
export const parentageTypeSchema = z.enum([
  "biological",
  "adoptive",
  "legal",
  "foster",
  "step",
]);
export const partnershipTypeSchema = z.enum([
  "marriage",
  "domestic_partnership",
  "other",
]);
export const partnershipStatusSchema = z.enum([
  "current",
  "ended",
  "divorced",
  "separated",
  "widowed",
  "unknown",
]);
export const guardianshipTypeSchema = z.enum(["legal", "informal", "foster", "other"]);
export const nameTypeSchema = z.enum([
  "maiden",
  "nickname",
  "alias",
  "previous",
  "alternate",
]);
export const familyRoleSchema = z.enum(["owner", "admin", "contributor", "viewer"]);

export function validPartialDate(value: string, precision: DatePrecision): boolean {
  if (!value) return precision === "unknown";
  if (precision === "unknown") return false;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  if (precision === "year") return monthText === undefined;
  if (precision === "month" && (monthText === undefined || dayText !== undefined)) {
    return false;
  }
  if (precision === "exact" && (monthText === undefined || dayText === undefined)) {
    return false;
  }
  if (monthText !== undefined) {
    const month = Number(monthText);
    if (month < 1 || month > 12) return false;
  }
  if (dayText !== undefined) {
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return false;
    }
  }
  return true;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .optional()
    .transform((value) => value || "");

export const personSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Enter a display name.")
      .max(200, "Use 200 characters or fewer."),
    givenName: optionalText(120),
    middleName: optionalText(120),
    surname: optionalText(120),
    suffix: optionalText(30),
    gender: optionalText(60),
    biography: optionalText(10000),
    birthDate: optionalText(10),
    birthDatePrecision: datePrecisionSchema,
    birthPlace: optionalText(200),
    deathDate: optionalText(10),
    deathDatePrecision: datePrecisionSchema,
    deathPlace: optionalText(200),
    lifeStatus: lifeStatusSchema,
  })
  .superRefine((value, ctx) => {
    if (!validPartialDate(value.birthDate, value.birthDatePrecision)) {
      ctx.addIssue({
        code: "custom",
        path: ["birthDate"],
        message: "Use a date that matches the selected precision.",
      });
    }
    if (!validPartialDate(value.deathDate, value.deathDatePrecision)) {
      ctx.addIssue({
        code: "custom",
        path: ["deathDate"],
        message: "Use a date that matches the selected precision.",
      });
    }
  });

export const nameSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200),
  nameType: nameTypeSchema,
});

export const parentageSchema = z
  .object({
    familyId: z.uuid(),
    personId: z.uuid(),
    relativeId: z.uuid("Choose a person."),
    mode: z.enum(["parent", "child"]),
    parentageType: parentageTypeSchema,
    startDate: optionalText(10),
    startDatePrecision: datePrecisionSchema,
    endDate: optionalText(10),
    endDatePrecision: datePrecisionSchema,
    notes: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (!validPartialDate(value.startDate, value.startDatePrecision)) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Use a date that matches the selected precision." });
    }
    if (!validPartialDate(value.endDate, value.endDatePrecision)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Use a date that matches the selected precision." });
    }
    if (value.personId === value.relativeId) {
      ctx.addIssue({ code: "custom", path: ["relativeId"], message: "Choose a different person." });
    }
  });

export const partnershipSchema = z
  .object({
    familyId: z.uuid(),
    personId: z.uuid(),
    partnerId: z.uuid("Choose a person."),
    partnershipType: partnershipTypeSchema,
    status: partnershipStatusSchema,
    startDate: optionalText(10),
    startDatePrecision: datePrecisionSchema,
    endDate: optionalText(10),
    endDatePrecision: datePrecisionSchema,
    location: optionalText(200),
    notes: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (!validPartialDate(value.startDate, value.startDatePrecision)) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Use a date that matches the selected precision." });
    }
    if (!validPartialDate(value.endDate, value.endDatePrecision)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Use a date that matches the selected precision." });
    }
    if (value.personId === value.partnerId) {
      ctx.addIssue({ code: "custom", path: ["partnerId"], message: "Choose a different person." });
    }
  });

export const guardianshipSchema = z
  .object({
    familyId: z.uuid(),
    personId: z.uuid(),
    relativeId: z.uuid("Choose a person."),
    direction: z.enum(["guardian", "ward"]),
    guardianshipType: guardianshipTypeSchema,
    startDate: optionalText(10),
    startDatePrecision: datePrecisionSchema,
    endDate: optionalText(10),
    endDatePrecision: datePrecisionSchema,
    notes: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (!validPartialDate(value.startDate, value.startDatePrecision)) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Use a date that matches the selected precision." });
    }
    if (!validPartialDate(value.endDate, value.endDatePrecision)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Use a date that matches the selected precision." });
    }
    if (value.personId === value.relativeId) {
      ctx.addIssue({ code: "custom", path: ["relativeId"], message: "Choose a different person." });
    }
  });

export const invitationSchema = z.object({
  familyId: z.uuid(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["admin", "contributor", "viewer"]),
  expiresInDays: z.coerce.number().int().min(1).max(30),
});

export const claimSchema = z.object({
  familyId: z.uuid(),
  personId: z.uuid(),
  message: optionalText(1000),
});
