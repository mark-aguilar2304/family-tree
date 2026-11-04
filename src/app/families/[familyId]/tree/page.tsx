import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page";
import { FamilyTree } from "@/components/tree/family-tree";
import { Button } from "@/components/ui/button";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Family tree" };

export default async function TreePage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { familyId } = await params;
  const { focus } = await searchParams;
  const access = await requireFamily(familyId);
  const supabase = await createClient();

  const [{ data: people }, { data: parentage }, { data: partnerships }, { data: participants }] =
    await Promise.all([
      supabase
        .from("persons")
        .select("*")
        .eq("family_id", familyId)
        .order("display_name"),
      supabase
        .from("parent_child_relationships")
        .select("*")
        .eq("family_id", familyId),
      supabase.from("partnerships").select("*").eq("family_id", familyId),
      supabase
        .from("partnership_participants")
        .select("*")
        .eq("family_id", familyId),
    ]);

  const activePeople = people ?? [];
  const initialFocusId = activePeople.some((person) => person.id === focus)
    ? focus
    : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Visualization"
        title="Family tree"
        description="Generated from saved people and relationship records. Pan, zoom, search, and focus on a branch."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/families/${familyId}/people`}>
                <Users /> People directory
              </Link>
            </Button>
            {access.canEdit && (
              <Button asChild>
                <Link href={`/families/${familyId}/people/new`}>
                  <UserPlus /> Add person
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mt-6">
        {activePeople.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" />}
            title="The tree is waiting for its first person"
            description="Add someone to this workspace and their card will appear here. Relationships you record later will draw the connections."
            action={
              access.canEdit ? (
                <Button asChild>
                  <Link href={`/families/${familyId}/people/new`}>
                    <UserPlus /> Add the first person
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <FamilyTree
            familyId={familyId}
            people={activePeople}
            parentage={parentage ?? []}
            partnerships={partnerships ?? []}
            participants={participants ?? []}
            initialFocusId={initialFocusId}
            canEdit={access.canEdit}
          />
        )}
      </div>
    </div>
  );
}
