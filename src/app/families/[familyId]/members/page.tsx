import type { Metadata } from "next";
import { Mail, UserPlus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { InviteMemberForm } from "@/components/members/invite-member-form";
import { PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectClassName } from "@/components/form-field";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { changeMemberRoleAction, removeMemberAction } from "@/lib/actions/members";
import { revokeInvitationAction } from "@/lib/actions/invitations";
import { roleDescriptions, roleLabels } from "@/lib/permissions";
import type { FamilyMember, Invitation, Profile } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Members" };

const statusVariant = {
  pending: "secondary",
  accepted: "default",
  expired: "outline",
  revoked: "destructive",
} as const;

export default async function MembersPage({
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
  const userIds = memberRows.map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("*").in("id", userIds)
    : { data: [] as Profile[] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const { data: invitationData } = access.canManage
    ? await supabase
        .from("invitations")
        .select(
          "id, family_id, email, role, status, invited_by, accepted_by, expires_at, accepted_at, revoked_at, created_at",
        )
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
    : { data: [] as Omit<Invitation, "token_hash" | "updated_at">[] };
  const invitations = invitationData ?? [];

  function canChange(member: FamilyMember): boolean {
    if (member.user_id === access.membership.user_id) return false;
    if (member.role === "owner") return false;
    if (access.isOwner) return true;
    return member.role !== "admin";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Collaboration"
        title="Members and invitations"
        description="Access is granted per workspace and per role. Every member sees only this family tree."
      />

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="size-4 text-primary" /> Members
              </CardTitle>
              <CardDescription>
                {memberRows.length} {memberRows.length === 1 ? "person has" : "people have"} access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {memberRows.map((member) => {
                const profile = profileById.get(member.user_id);
                const isSelf = member.user_id === access.membership.user_id;
                return (
                  <div
                    key={member.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {profile?.full_name || "Family member"}
                          {isSelf && <Badge variant="outline">You</Badge>}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                        {roleLabels[member.role]}
                      </Badge>
                    </div>

                    {access.canManage && canChange(member) ? (
                      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border/70 pt-4">
                        <ActionForm
                          action={changeMemberRoleAction}
                          submitLabel="Save role"
                          pendingLabel="Saving…"
                          variant="outline"
                          size="sm"
                          className="flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="familyId" value={familyId} />
                          <input type="hidden" name="userId" value={member.user_id} />
                          <label htmlFor={`role-${member.id}`} className="sr-only">
                            Role for {profile?.full_name || "member"}
                          </label>
                          <select
                            id={`role-${member.id}`}
                            name="role"
                            defaultValue={member.role}
                            className={`${selectClassName} w-40`}
                          >
                            {access.isOwner && <option value="admin">Admin</option>}
                            <option value="contributor">Contributor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </ActionForm>
                        <ActionForm
                          action={removeMemberAction}
                          submitLabel="Remove"
                          pendingLabel="Removing…"
                          variant="destructive"
                          size="sm"
                          confirmMessage={`Remove ${profile?.full_name || "this member"} from ${access.family.name}?`}
                          className="inline-flex"
                        >
                          <input type="hidden" name="familyId" value={familyId} />
                          <input type="hidden" name="userId" value={member.user_id} />
                        </ActionForm>
                      </div>
                    ) : (
                      <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                        {roleDescriptions[member.role]}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {access.canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="size-4 text-primary" /> Invitations
                </CardTitle>
                <CardDescription>
                  Pending, accepted, expired, and revoked invitations for this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invitations yet.</p>
                ) : (
                  invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{invitation.email}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {roleLabels[invitation.role]} · expires{" "}
                          {new Date(invitation.expires_at).toLocaleDateString()}
                          {invitation.status === "accepted" && invitation.accepted_at
                            ? ` · accepted ${new Date(invitation.accepted_at).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant[invitation.status]}>
                          {invitation.status}
                        </Badge>
                        {invitation.status === "pending" && (
                          <ActionForm
                            action={revokeInvitationAction}
                            submitLabel="Revoke"
                            pendingLabel="Revoking…"
                            variant="ghost"
                            size="sm"
                            confirmMessage={`Revoke the invitation for ${invitation.email}?`}
                            className="inline-flex"
                          >
                            <input type="hidden" name="familyId" value={familyId} />
                            <input type="hidden" name="invitationId" value={invitation.id} />
                          </ActionForm>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {access.canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Invite a relative</CardTitle>
                <CardDescription>
                  Create a single-use link. If email delivery is configured, it is sent
                  automatically; otherwise copy the link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InviteMemberForm familyId={familyId} inviterRole={access.role} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Invitations</CardTitle>
                <CardDescription>
                  Only owners and admins can invite people or change roles.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Role guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(Object.keys(roleLabels) as Array<keyof typeof roleLabels>).map((role) => (
                <div key={role}>
                  <p className="font-medium">{roleLabels[role]}</p>
                  <p className="text-xs text-muted-foreground">{roleDescriptions[role]}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
