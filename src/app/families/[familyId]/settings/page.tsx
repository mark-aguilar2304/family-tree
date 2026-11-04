import type { Metadata } from "next";
import { Archive, ArrowRightLeft, LogOut, Settings2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/form-field";
import { PageHeader } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  archiveFamilyAction,
  leaveFamilyAction,
  restoreFamilyAction,
  transferOwnershipAction,
  updateFamilyAction,
} from "@/lib/actions/families";
import { selectClassName } from "@/components/form-field";
import type { Profile } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Workspace settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const access = await requireFamily(familyId);
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("family_members")
    .select("*")
    .eq("family_id", familyId)
    .order("joined_at");
  const memberRows = members ?? [];
  const { data: profiles } = memberRows.length
    ? await supabase
        .from("profiles")
        .select("*")
        .in("id", memberRows.map((member) => member.user_id))
    : { data: [] as Profile[] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const otherMembers = memberRows.filter(
    (member) => member.user_id !== access.family.owner_id,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Administration"
        title="Workspace settings"
        description="Manage this family tree's identity, ownership, and lifecycle."
      />

      <div className="mt-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-4 text-primary" /> Workspace details
            </CardTitle>
            <CardDescription>
              The name and description appear on your dashboard and workspace header.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {access.canManage ? (
              <ActionForm
                action={updateFamilyAction}
                submitLabel="Save details"
                pendingLabel="Saving…"
                className="space-y-4"
              >
                <input type="hidden" name="familyId" value={familyId} />
                <Field label="Family name" htmlFor="settings-name" required>
                  <Input
                    id="settings-name"
                    name="name"
                    defaultValue={access.family.name}
                    required
                    maxLength={120}
                  />
                </Field>
                <Field label="Description" htmlFor="settings-description">
                  <Textarea
                    id="settings-description"
                    name="description"
                    rows={4}
                    maxLength={2000}
                    defaultValue={access.family.description ?? ""}
                  />
                </Field>
              </ActionForm>
            ) : (
              <Alert>
                <AlertDescription>
                  Only owners and admins can edit workspace details. You are signed in
                  as a {access.role}.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {access.isOwner && !access.isArchived && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="size-4 text-primary" /> Transfer ownership
              </CardTitle>
              <CardDescription>
                The new owner gets full control. You become an admin and cannot undo
                this transfer yourself.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {otherMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Invite and admit another member before transferring ownership.
                </p>
              ) : (
                <ActionForm
                  action={transferOwnershipAction}
                  submitLabel="Transfer ownership"
                  pendingLabel="Transferring…"
                  variant="outline"
                  confirmMessage="Transfer ownership of this workspace? You will become an admin."
                  className="flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="familyId" value={familyId} />
                  <Field label="New owner" htmlFor="new-owner" className="min-w-64">
                    <select id="new-owner" name="newOwnerId" className={selectClassName} required>
                      <option value="">Choose a member…</option>
                      {otherMembers.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {profileById.get(member.user_id)?.full_name || "Family member"}
                        </option>
                      ))}
                    </select>
                  </Field>
                </ActionForm>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="size-4 text-primary" /> Workspace lifecycle
            </CardTitle>
            <CardDescription>
              Archiving makes the tree read-only and keeps every record intact.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {access.isOwner ? (
              access.isArchived ? (
                <ActionForm
                  action={restoreFamilyAction}
                  submitLabel="Restore workspace"
                  pendingLabel="Restoring…"
                  className="space-y-3"
                >
                  <input type="hidden" name="familyId" value={familyId} />
                </ActionForm>
              ) : (
                <ActionForm
                  action={archiveFamilyAction}
                  submitLabel="Archive workspace"
                  pendingLabel="Archiving…"
                  variant="destructive"
                  confirmMessage="Archive this workspace? It becomes read-only until you restore it."
                  className="space-y-3"
                >
                  <input type="hidden" name="familyId" value={familyId} />
                </ActionForm>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                Only the owner can archive or restore this workspace.
              </p>
            )}
          </CardContent>
        </Card>

        {!access.isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="size-4 text-primary" /> Leave workspace
              </CardTitle>
              <CardDescription>
                You will lose access immediately. Your edits and records remain.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={leaveFamilyAction}
                submitLabel="Leave workspace"
                pendingLabel="Leaving…"
                variant="destructive"
                confirmMessage="Leave this workspace? You will need a new invitation to return."
                className="space-y-3"
              >
                <input type="hidden" name="familyId" value={familyId} />
              </ActionForm>
            </CardContent>
          </Card>
        )}

        {access.isOwner && (
          <Alert>
            <AlertDescription>
              As the owner, transfer ownership before leaving. A workspace cannot be
              left without an owner.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
