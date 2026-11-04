import type {
  DatePrecision,
  FamilyRole,
  GuardianshipType,
  LifeStatus,
  NameType,
  ParentageType,
  PartnershipStatus,
  PartnershipType,
} from "@/lib/supabase/database.types";

export function canEdit(role: FamilyRole): boolean {
  return role === "owner" || role === "admin" || role === "contributor";
}

export function canManage(role: FamilyRole): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: FamilyRole): boolean {
  return role === "owner";
}

export const roleLabels: Record<FamilyRole, string> = {
  owner: "Owner",
  admin: "Admin",
  contributor: "Contributor",
  viewer: "Viewer",
};

export const roleDescriptions: Record<FamilyRole, string> = {
  owner: "Full control, including ownership transfer and archiving.",
  admin: "Can edit the tree, invite members, and manage most settings.",
  contributor: "Can add and edit people and relationships.",
  viewer: "Can explore the tree and read profiles.",
};

export const parentageLabels: Record<ParentageType, string> = {
  biological: "Biological",
  adoptive: "Adoptive",
  legal: "Legal",
  foster: "Foster",
  step: "Step",
};

export const partnershipTypeLabels: Record<PartnershipType, string> = {
  marriage: "Marriage",
  domestic_partnership: "Domestic partnership",
  other: "Other partnership",
};

export const partnershipStatusLabels: Record<PartnershipStatus, string> = {
  current: "Current",
  ended: "Ended",
  divorced: "Divorced",
  separated: "Separated",
  widowed: "Widowed",
  unknown: "Unknown",
};

export const guardianshipTypeLabels: Record<GuardianshipType, string> = {
  legal: "Legal",
  informal: "Informal",
  foster: "Foster",
  other: "Other",
};

export const lifeStatusLabels: Record<LifeStatus, string> = {
  living: "Living",
  deceased: "Deceased",
  unknown: "Unknown",
};

export const nameTypeLabels: Record<NameType, string> = {
  maiden: "Maiden name",
  nickname: "Nickname",
  alias: "Alias",
  previous: "Previous name",
  alternate: "Alternate spelling",
};

export const datePrecisionLabels: Record<DatePrecision, string> = {
  exact: "Exact date",
  month: "Month and year",
  year: "Year only",
  approximate: "Approximate",
  unknown: "Unknown",
};

export const datePrecisionPlaceholders: Record<DatePrecision, string> = {
  exact: "1994-03-18",
  month: "1994-03",
  year: "1994",
  approximate: "1994 or 1994-03 or 1994-03-18",
  unknown: "Leave blank",
};
