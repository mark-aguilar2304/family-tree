import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Family, FamilyMember, FamilyRole } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser(nextPath = "/dashboard"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export type FamilyAccess = {
  family: Family;
  membership: FamilyMember;
  role: FamilyRole;
  canEdit: boolean;
  canManage: boolean;
  isOwner: boolean;
  isArchived: boolean;
};

export const requireFamily = cache(
  async (familyId: string): Promise<FamilyAccess> => {
    const user = await requireUser(`/families/${familyId}`);
    const supabase = await createClient();

    const [{ data: family }, { data: membership }] = await Promise.all([
      supabase.from("families").select("*").eq("id", familyId).maybeSingle(),
      supabase
        .from("family_members")
        .select("*")
        .eq("family_id", familyId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!family || !membership) {
      notFound();
    }

    const isArchived = family.archived_at !== null;
    return {
      family,
      membership,
      role: membership.role,
      canEdit:
        !isArchived &&
        (membership.role === "owner" ||
          membership.role === "admin" ||
          membership.role === "contributor"),
      canManage:
        !isArchived &&
        (membership.role === "owner" || membership.role === "admin"),
      isOwner: membership.role === "owner",
      isArchived,
    };
  },
);
