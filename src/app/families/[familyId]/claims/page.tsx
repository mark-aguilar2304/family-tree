import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ShieldCheck, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { EmptyState, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePersonClaimAction } from "@/lib/actions/claims";
import type { Person, Profile } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Claims" };

const statusVariant = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  withdrawn: "outline",
} as const;

export default async function ClaimsPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const access = await requireFamily(familyId);
  if (!access.canManage) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase
    .from("person_claims")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(50);

  const claimRows = claims ?? [];
  const personIds = [...new Set(claimRows.map((claim) => claim.person_id))];
  const userIds = [
    ...new Set(
      claimRows.flatMap((claim) =>
        claim.resolved_by ? [claim.user_id, claim.resolved_by] : [claim.user_id],
      ),
    ),
  ];
  const [{ data: people }, { data: profiles }] = await Promise.all([
    personIds.length
      ? supabase.from("persons").select("*").in("id", personIds)
      : Promise.resolve({ data: [] as Person[] }),
    userIds.length
      ? supabase.from("profiles").select("*").in("id", userIds)
      : Promise.resolve({ data: [] as Profile[] }),
  ]);
  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const pending = claimRows.filter((claim) => claim.status === "pending");
  const resolved = claimRows.filter((claim) => claim.status !== "pending");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Account links"
        title="Profile claims"
        description="Review requests from members who believe a living-person record is theirs. Approval links the account but does not grant extra workspace permissions."
      />

      {claimRows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<ShieldCheck className="size-8" />}
            title="No claims to review"
            description="When a member asks to link their account to a living-person profile, the request will appear here."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending claims</CardTitle>
              <CardDescription>
                {pending.length} {pending.length === 1 ? "request needs" : "requests need"} a decision.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending claims.</p>
              ) : (
                pending.map((claim) => {
                  const person = personById.get(claim.person_id);
                  const claimant = profileById.get(claim.user_id);
                  return (
                    <div key={claim.id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">
                              {claimant?.full_name || "A family member"}
                            </span>{" "}
                            claims{" "}
                            {person ? (
                              <Link
                                href={`/families/${familyId}/people/${person.id}`}
                                className="font-medium underline-offset-4 hover:text-primary hover:underline"
                              >
                                {person.display_name}
                              </Link>
                            ) : (
                              "a person record"
                            )}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Requested {new Date(claim.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                      {claim.message && (
                        <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-sm leading-relaxed">
                          {claim.message}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                        <ActionForm
                          action={resolvePersonClaimAction}
                          submitLabel="Approve claim"
                          pendingLabel="Approving…"
                          size="sm"
                          className="inline-flex"
                        >
                          <input type="hidden" name="familyId" value={familyId} />
                          <input type="hidden" name="personId" value={claim.person_id} />
                          <input type="hidden" name="claimId" value={claim.id} />
                          <input type="hidden" name="approve" value="true" />
                        </ActionForm>
                        <ActionForm
                          action={resolvePersonClaimAction}
                          submitLabel="Reject claim"
                          pendingLabel="Rejecting…"
                          variant="destructive"
                          size="sm"
                          confirmMessage="Reject this claim? The member can request again later."
                          className="inline-flex"
                        >
                          <input type="hidden" name="familyId" value={familyId} />
                          <input type="hidden" name="personId" value={claim.person_id} />
                          <input type="hidden" name="claimId" value={claim.id} />
                          <input type="hidden" name="approve" value="false" />
                        </ActionForm>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {resolved.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent decisions</CardTitle>
                <CardDescription>The last 50 claims for this workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {resolved.map((claim) => {
                  const person = personById.get(claim.person_id);
                  const claimant = profileById.get(claim.user_id);
                  const resolver = claim.resolved_by
                    ? profileById.get(claim.resolved_by)
                    : undefined;
                  return (
                    <div
                      key={claim.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                    >
                      <div>
                        <p>
                          {claimant?.full_name || "A family member"} →{" "}
                          {person?.display_name || "person record"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {claim.resolved_at
                            ? new Date(claim.resolved_at).toLocaleString()
                            : new Date(claim.created_at).toLocaleString()}
                          {resolver ? ` · by ${resolver.full_name}` : ""}
                        </p>
                      </div>
                      <Badge variant={statusVariant[claim.status]}>
                        {claim.status === "approved" && <Check />}
                        {claim.status === "rejected" && <X />}
                        {claim.status}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
