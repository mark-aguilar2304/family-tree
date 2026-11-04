import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PersonForm } from "@/components/people/person-form";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireFamily } from "@/lib/auth";
import { createPersonAction } from "@/lib/actions/people";

export const metadata: Metadata = { title: "Add person" };

export default async function NewPersonPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const access = await requireFamily(familyId);
  if (!access.canEdit) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={`/families/${familyId}/people`}>
          <ArrowLeft /> Back to people
        </Link>
      </Button>
      <PageHeader
        eyebrow="New record"
        title="Add a person"
        description="Begin with what you know. Names, dates, and places can stay incomplete."
        className="mb-8"
      />
      <PersonForm
        action={createPersonAction}
        familyId={familyId}
        submitLabel="Save person"
      />
    </div>
  );
}
