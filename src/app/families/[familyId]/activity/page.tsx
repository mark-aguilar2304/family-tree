import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog, Json, Person, Profile } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Activity" };

const entityLabels: Record<string, string> = {
  persons: "Person",
  person_names: "Alternate name",
  parent_child_relationships: "Parentage",
  partnerships: "Partnership",
  partnership_participants: "Partnership participant",
  guardianships: "Guardianship",
  invitations: "Invitation",
  family_members: "Membership",
  families: "Workspace",
  person_claims: "Claim",
  person_account_links: "Account link",
};

const ignoredFields = new Set(["updated_at", "version", "token_hash"]);

function asRecord(value: Json | null): Record<string, Json | undefined> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value;
}

function changedFields(log: AuditLog): string[] {
  if (log.action !== "update") return [];
  const before = asRecord(log.old_values);
  const after = asRecord(log.new_values);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) =>
      !ignoredFields.has(key) &&
      JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

function fieldLabel(field: string): string {
  return field.replaceAll("_", " ");
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const access = await requireFamily(familyId);
  if (!access.canManage) notFound();

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(100);
  const logRows = logs ?? [];

  const actorIds = [...new Set(logRows.map((log) => log.actor_user_id).filter((id): id is string => Boolean(id)))];
  const personIds = [
    ...new Set(
      logRows
        .filter((log) => log.entity_type === "persons" && log.entity_id)
        .map((log) => log.entity_id as string),
    ),
  ];
  const [{ data: profiles }, { data: people }] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("*").in("id", actorIds)
      : Promise.resolve({ data: [] as Profile[] }),
    personIds.length
      ? supabase.from("persons").select("*").in("id", personIds)
      : Promise.resolve({ data: [] as Person[] }),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const personById = new Map((people ?? []).map((person) => [person.id, person]));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Audit history"
        title="Activity"
        description="Important changes in this workspace, attributed to the person who made them. The most recent 100 events are shown."
      />

      {logRows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<History className="size-8" />}
            title="No activity recorded yet"
            description="Changes to people, relationships, members, and settings will appear here."
          />
        </div>
      ) : (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent changes</CardTitle>
            <CardDescription>
              Invitation token hashes and other secrets are never written to the audit log.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="divide-y divide-border/70">
              {logRows.map((log) => {
                const actor = log.actor_user_id
                  ? profileById.get(log.actor_user_id)
                  : undefined;
                const entityName =
                  log.entity_type === "persons" && log.entity_id
                    ? personById.get(log.entity_id)?.display_name
                    : undefined;
                const changed = changedFields(log);
                return (
                  <li key={log.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm">
                        <p>
                          <span className="font-medium">
                            {actor?.full_name || "Someone"}
                          </span>{" "}
                          {log.action === "insert"
                            ? "added"
                            : log.action === "delete"
                              ? "removed"
                              : "updated"}{" "}
                          <span className="font-medium">
                            {entityLabels[log.entity_type] ?? log.entity_type}
                          </span>
                          {entityName ? (
                            <>
                              {" "}
                              <Link
                                href={`/families/${familyId}/people/${log.entity_id}`}
                                className="font-medium underline-offset-4 hover:text-primary hover:underline"
                              >
                                {entityName}
                              </Link>
                            </>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                          {changed.length > 0
                            ? ` · ${changed.map(fieldLabel).join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant={log.action === "delete" ? "destructive" : "outline"}>
                        {log.action}
                      </Badge>
                    </div>
                    {(log.old_values || log.new_values) && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          View recorded values
                        </summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {log.old_values && (
                            <div>
                              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Before
                              </p>
                              <pre className="max-h-56 overflow-auto rounded-lg bg-secondary/60 p-2 text-[10px] leading-relaxed">
                                {JSON.stringify(log.old_values, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_values && (
                            <div>
                              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                After
                              </p>
                              <pre className="max-h-56 overflow-auto rounded-lg bg-secondary/60 p-2 text-[10px] leading-relaxed">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
