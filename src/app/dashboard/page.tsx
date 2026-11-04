import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, MapPin, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { EmptyState, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createFamilyAction } from "@/lib/actions/families";
import { roleLabels } from "@/lib/permissions";
import type { Family, FamilyMember } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Workspaces" };

type MembershipWithFamily = FamilyMember & { family: Family | null };

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: memberships }, { data: invitations }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("family_members").select("*").eq("user_id", user.id).order("joined_at"),
      supabase.rpc("list_my_invitations"),
    ]);

  const familyIds = (memberships ?? []).map((membership) => membership.family_id);
  const { data: families } = familyIds.length
    ? await supabase.from("families").select("*").in("id", familyIds)
    : { data: [] as Family[] };

  const familyById = new Map((families ?? []).map((family) => [family.id, family]));
  const rows: MembershipWithFamily[] = (memberships ?? []).map((membership) => ({
    ...membership,
    family: familyById.get(membership.family_id) ?? null,
  }));
  const pendingInvitations = invitations ?? [];

  return (
    <AppShell
      user={{ email: user.email, fullName: profile?.full_name ?? null }}
    >
      <PageHeader
        eyebrow="Your account"
        title="Family workspaces"
        description="Each workspace is one private family tree. You can belong to as many as your family invites you to."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="workspace-list">
          <h2 id="workspace-list" className="sr-only">
            Your workspaces
          </h2>
          {rows.length === 0 ? (
            <EmptyState
              icon={<Users className="size-8" />}
              title="No family workspace yet"
              description="Create a workspace for your family, or open the invitation link a relative sent you."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map(({ family, role }) => {
                if (!family) return null;
                return (
                  <Link
                    key={family.id}
                    href={`/families/${family.id}`}
                    className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/35 hover:bg-card/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-primary/8 text-primary">
                        <MapPin className="size-5" />
                      </span>
                      <Badge variant={role === "owner" ? "default" : "secondary"}>
                        {roleLabels[role]}
                      </Badge>
                    </div>
                    <h3 className="mt-4 font-heading text-xl font-medium group-hover:text-primary">
                      {family.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {family.description || "A private family record."}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground">
                      <span>
                        {family.archived_at ? "Archived" : `Joined ${new Date(family.created_at).getFullYear()}`}
                      </span>
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {pendingInvitations.length > 0 && (
            <section className="mt-10" aria-labelledby="invitations-heading">
              <h2 id="invitations-heading" className="text-lg font-medium">
                Pending invitations
              </h2>
              <div className="mt-3 space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{invitation.family_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabels[invitation.role]} · expires{" "}
                        {new Date(invitation.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      Open the invitation link in your email to join
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="size-4 text-primary" />
                Create a workspace
              </CardTitle>
              <CardDescription>
                Start a new private tree. You will be its owner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createFamilyAction}
                submitLabel="Create workspace"
                pendingLabel="Creating…"
                className="space-y-4"
              >
                <Field label="Family name" htmlFor="family-name" required>
                  <Input
                    id="family-name"
                    name="name"
                    required
                    maxLength={120}
                    placeholder="The Rivera Family"
                  />
                </Field>
                <Field
                  label="Description"
                  htmlFor="family-description"
                  hint="Optional. A sentence about this branch of the family."
                >
                  <Textarea
                    id="family-description"
                    name="description"
                    maxLength={2000}
                    rows={3}
                    placeholder="Our family's records, gathered together."
                  />
                </Field>
              </ActionForm>
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
