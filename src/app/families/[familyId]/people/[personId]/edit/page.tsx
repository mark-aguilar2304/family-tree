import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PersonForm } from "@/components/people/person-form";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updatePersonAction } from "@/lib/actions/people";

export const metadata: Metadata = { title: "Edit person" };

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ familyId: string; personId: string }>;
}) {
  const { familyId, personId } = await params;
  const access = await requireFamily(familyId);
  if (!access.canEdit) notFound();

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("*")
    .eq("id", personId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (!person) notFound();
  if (person.archived_at) redirect(`/families/${familyId}/people/${personId}`);

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={`/families/${familyId}/people/${personId}`}>
          <ArrowLeft /> Back to profile
        </Link>
      </Button>
      <PageHeader
        eyebrow="Edit record"
        title={`Edit ${person.display_name}`}
        description="Changes are checked against the version you opened, so another person's edit is never silently overwritten."
        className="mb-8"
      />
      <PersonForm
        action={updatePersonAction}
        familyId={familyId}
        person={person}
        submitLabel="Save changes"
      />
    </div>
  );
}
