import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Edit3,
  GitBranch,
  Link2,
  RotateCcw,
  Shield,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Field, selectClassName } from "@/components/form-field";
import { PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AddGuardianshipForm,
  AddParentageForm,
  AddPartnershipForm,
  EndGuardianshipForm,
  EndParentageForm,
  UpdatePartnershipForm,
} from "@/components/people/relationship-forms";
import { requireFamily } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archivePersonAction, addNameAction, removeNameAction, restorePersonAction } from "@/lib/actions/people";
import { requestPersonClaimAction, withdrawPersonClaimAction } from "@/lib/actions/claims";
import { deriveSiblings, siblingLabel } from "@/lib/genealogy/kinship";
import { describeDate, lifeDates } from "@/lib/dates";
import {
  guardianshipTypeLabels,
  lifeStatusLabels,
  nameTypeLabels,
  parentageLabels,
  partnershipStatusLabels,
  partnershipTypeLabels,
} from "@/lib/permissions";
import type {
  Guardianship,
  Parentage,
  Partnership,
  PartnershipParticipant,
  Person,
  PersonName,
} from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Person" };

function PersonInline({ person }: { person: Person | undefined }) {
  if (!person) return <span className="text-muted-foreground">Unknown person</span>;
  return (
    <Link
      href={`/families/${person.family_id}/people/${person.id}`}
      className="font-medium underline-offset-4 hover:text-primary hover:underline"
    >
      {person.display_name}
    </Link>
  );
}

function RelationshipDates({
  start,
  startPrecision,
  end,
  endPrecision,
}: {
  start: string | null;
  startPrecision: Parentage["start_date_precision"];
  end: string | null;
  endPrecision: Parentage["end_date_precision"];
}) {
  const startLabel =
    start && startPrecision !== "unknown" ? describeDate(start, startPrecision) : null;
  const endLabel = end && endPrecision !== "unknown" ? describeDate(end, endPrecision) : null;
  if (!startLabel && !endLabel) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {startLabel ?? "Start unknown"} – {endLabel ?? (end ? "end unknown" : "ongoing")}
    </span>
  );
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ familyId: string; personId: string }>;
}) {
  const { familyId, personId } = await params;
  const access = await requireFamily(familyId);
  const supabase = await createClient();

  const [
    { data: person },
    { data: names },
    { data: people },
    { data: parentage },
    { data: guardianships },
    { data: myParticipations },
    { data: myLinks },
    { data: claims },
  ] = await Promise.all([
    supabase
      .from("persons")
      .select("*")
      .eq("id", personId)
      .eq("family_id", familyId)
      .maybeSingle(),
    supabase
      .from("person_names")
      .select("*")
      .eq("person_id", personId)
      .order("created_at"),
    supabase
      .from("persons")
      .select("*")
      .eq("family_id", familyId)
      .order("display_name"),
    supabase
      .from("parent_child_relationships")
      .select("*")
      .eq("family_id", familyId)
      .or(`parent_id.eq.${personId},child_id.eq.${personId}`),
    supabase
      .from("guardianships")
      .select("*")
      .eq("family_id", familyId)
      .or(`guardian_id.eq.${personId},ward_id.eq.${personId}`),
    supabase
      .from("partnership_participants")
      .select("*")
      .eq("person_id", personId)
      .eq("family_id", familyId),
    supabase
      .from("person_account_links")
      .select("*")
      .eq("family_id", familyId)
      .eq("user_id", access.membership.user_id),
    supabase.from("person_claims").select("*").eq("person_id", personId),
  ]);

  if (!person) notFound();

  const partnershipIds = (myParticipations ?? []).map((row) => row.partnership_id);
  const [{ data: partnerships }, { data: allParticipants }] = await Promise.all([
    partnershipIds.length
      ? supabase.from("partnerships").select("*").in("id", partnershipIds)
      : Promise.resolve({ data: [] as Partnership[] }),
    partnershipIds.length
      ? supabase
          .from("partnership_participants")
          .select("*")
          .in("partnership_id", partnershipIds)
      : Promise.resolve({ data: [] as PartnershipParticipant[] }),
  ]);

  const allPeople = people ?? [];
  const personById = new Map(allPeople.map((entry) => [entry.id, entry]));
  const activePeople = allPeople.filter((entry) => !entry.archived_at);
  const parentageRows = parentage ?? [];
  const guardianshipRows = guardianships ?? [];
  const nameRows = names ?? [];
  const claimRows = claims ?? [];
  const linkRows = myLinks ?? [];

  const parents = parentageRows.filter((edge) => edge.child_id === personId);
  const children = parentageRows.filter((edge) => edge.parent_id === personId);
  const siblings = deriveSiblings(personId, parentageRows, activePeople);
  const guardianOf = guardianshipRows.filter((edge) => edge.guardian_id === personId);
  const wardOf = guardianshipRows.filter((edge) => edge.ward_id === personId);
  const partnershipRows = (partnerships ?? [])
    .map((partnership) => ({
      partnership,
      participants: (allParticipants ?? []).filter(
        (participant) => participant.partnership_id === partnership.id,
      ),
    }))
    .sort((a, b) => a.partnership.created_at.localeCompare(b.partnership.created_at));

  const linkedToMe = linkRows.some((link) => link.person_id === person.id);
  const myPendingClaim = claimRows.find(
    (claim) => claim.user_id === access.membership.user_id && claim.status === "pending",
  );
  const canRequestClaim =
    person.life_status === "living" &&
    !person.archived_at &&
    !person.is_claimed &&
    !linkedToMe &&
    !myPendingClaim;
  const pendingClaimCount = claimRows.filter((claim) => claim.status === "pending").length;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={`/families/${familyId}/people`}>
          <ArrowLeft /> Back to people
        </Link>
      </Button>

      <PageHeader
        eyebrow={access.family.name}
        title={person.display_name}
        description={lifeDates(person)}
        actions={
          <>
            {access.canEdit && !person.archived_at && (
              <Button asChild variant="outline">
                <Link href={`/families/${familyId}/people/${personId}/edit`}>
                  <Edit3 /> Edit profile
                </Link>
              </Button>
            )}
            {access.canManage && pendingClaimCount > 0 && (
              <Button asChild variant="outline">
                <Link href={`/families/${familyId}/claims`}>
                  <UserRoundCheck /> Review claims
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={person.life_status === "deceased" ? "secondary" : "outline"}>
          {lifeStatusLabels[person.life_status]}
        </Badge>
        {person.is_claimed && <Badge variant="secondary">Account linked</Badge>}
        {person.archived_at && <Badge variant="destructive">Archived</Badge>}
        {access.role === "viewer" && <Badge variant="outline">Read only</Badge>}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Life and story</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {person.biography ? (
                <p className="text-sm leading-relaxed whitespace-pre-line text-pretty">
                  {person.biography}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No biography has been added yet.
                </p>
              )}
              <dl className="grid gap-4 border-t border-border/70 pt-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Birth</dt>
                  <dd className="mt-0.5">
                    {person.birth_date
                      ? describeDate(person.birth_date, person.birth_date_precision)
                      : "Unknown"}
                    {person.birth_place ? ` · ${person.birth_place}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Death</dt>
                  <dd className="mt-0.5">
                    {person.life_status === "living"
                      ? "—"
                      : person.death_date
                        ? describeDate(person.death_date, person.death_date_precision)
                        : "Unknown"}
                    {person.death_place ? ` · ${person.death_place}` : ""}
                  </dd>
                </div>
                {person.gender && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Gender</dt>
                    <dd className="mt-0.5">{person.gender}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Record updated</dt>
                  <dd className="mt-0.5">
                    {new Date(person.updated_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="size-4 text-primary" /> Relationships
              </CardTitle>
              <CardDescription>
                Parentage, partnerships, and guardianship are stored independently.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <section aria-labelledby="parents-heading">
                <h3 id="parents-heading" className="text-sm font-medium">
                  Parents
                </h3>
                {parents.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No parents recorded.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {parents.map((edge) => {
                      const parent = personById.get(edge.parent_id);
                      return (
                        <li key={edge.id} className="rounded-lg border border-border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <PersonInline person={parent} />
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{parentageLabels[edge.parentage_type]}</Badge>
                                <RelationshipDates
                                  start={edge.start_date}
                                  startPrecision={edge.start_date_precision}
                                  end={edge.end_date}
                                  endPrecision={edge.end_date_precision}
                                />
                              </div>
                            </div>
                          </div>
                          {edge.notes && (
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                              {edge.notes}
                            </p>
                          )}
                          {access.canEdit && !person.archived_at && !edge.end_date && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-medium text-primary">
                                End this parentage record
                              </summary>
                              <EndParentageForm
                                familyId={familyId}
                                personId={personId}
                                recordId={edge.id}
                              />
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {access.canEdit && !person.archived_at && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Add a parent
                    </summary>
                    <div className="mt-3">
                      <AddParentageForm
                        familyId={familyId}
                        person={person}
                        people={activePeople}
                        mode="parent"
                      />
                    </div>
                  </details>
                )}
              </section>

              <section aria-labelledby="children-heading">
                <h3 id="children-heading" className="text-sm font-medium">
                  Children
                </h3>
                {children.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No children recorded.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {children.map((edge) => {
                      const child = personById.get(edge.child_id);
                      return (
                        <li key={edge.id} className="rounded-lg border border-border p-3">
                          <PersonInline person={child} />
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{parentageLabels[edge.parentage_type]}</Badge>
                            <RelationshipDates
                              start={edge.start_date}
                              startPrecision={edge.start_date_precision}
                              end={edge.end_date}
                              endPrecision={edge.end_date_precision}
                            />
                          </div>
                          {access.canEdit && !person.archived_at && !edge.end_date && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-medium text-primary">
                                End this parentage record
                              </summary>
                              <EndParentageForm
                                familyId={familyId}
                                personId={personId}
                                recordId={edge.id}
                              />
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {access.canEdit && !person.archived_at && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Add a child
                    </summary>
                    <div className="mt-3">
                      <AddParentageForm
                        familyId={familyId}
                        person={person}
                        people={activePeople}
                        mode="child"
                      />
                    </div>
                  </details>
                )}
              </section>

              <section aria-labelledby="siblings-heading">
                <h3 id="siblings-heading" className="text-sm font-medium">
                  Siblings
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculated from shared parentage, never stored as duplicate edges.
                </p>
                {siblings.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No siblings derived yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {siblings.map((sibling) => (
                      <li key={sibling.person.id} className="flex items-center justify-between gap-3 text-sm">
                        <PersonInline person={sibling.person} />
                        <Badge variant="outline">{siblingLabel(sibling.kind)}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="partnerships-heading">
                <h3 id="partnerships-heading" className="text-sm font-medium">
                  Partnerships
                </h3>
                {partnershipRows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No partnerships recorded.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {partnershipRows.map(({ partnership, participants }) => {
                      const others = participants
                        .filter((participant) => participant.person_id !== personId)
                        .map((participant) => personById.get(participant.person_id));
                      return (
                        <li key={partnership.id} className="rounded-lg border border-border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link2 className="size-3.5 text-muted-foreground" />
                            <span className="text-sm">
                              With{" "}
                              {others.map((other, index) => (
                                <span key={other?.id ?? index}>
                                  <PersonInline person={other} />
                                  {index < others.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </span>
                            <Badge variant="outline">
                              {partnershipTypeLabels[partnership.partnership_type]}
                            </Badge>
                            <Badge variant="secondary">
                              {partnershipStatusLabels[partnership.status]}
                            </Badge>
                          </div>
                          <div className="mt-1">
                            <RelationshipDates
                              start={partnership.start_date}
                              startPrecision={partnership.start_date_precision}
                              end={partnership.end_date}
                              endPrecision={partnership.end_date_precision}
                            />
                          </div>
                          {partnership.location && (
                            <p className="mt-1 text-xs text-muted-foreground">{partnership.location}</p>
                          )}
                          {partnership.notes && (
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                              {partnership.notes}
                            </p>
                          )}
                          {access.canEdit && !person.archived_at && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-medium text-primary">
                                Update status or end date
                              </summary>
                              <UpdatePartnershipForm
                                familyId={familyId}
                                personId={personId}
                                partnershipId={partnership.id}
                                currentStatus={partnership.status}
                              />
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {access.canEdit && !person.archived_at && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Add a partnership
                    </summary>
                    <div className="mt-3">
                      <AddPartnershipForm familyId={familyId} person={person} people={activePeople} />
                    </div>
                  </details>
                )}
              </section>

              <section aria-labelledby="guardianships-heading">
                <h3 id="guardianships-heading" className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="size-4 text-primary" /> Guardianship
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Guardianship is independent of parentage.
                </p>
                {guardianOf.length === 0 && wardOf.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No guardianships recorded.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {guardianOf.map((edge) => (
                      <GuardianshipRow
                        key={edge.id}
                        edge={edge}
                        person={personById.get(edge.ward_id)}
                        label="Guardian of"
                        familyId={familyId}
                        personId={personId}
                        canEdit={access.canEdit && !person.archived_at}
                      />
                    ))}
                    {wardOf.map((edge) => (
                      <GuardianshipRow
                        key={edge.id}
                        edge={edge}
                        person={personById.get(edge.guardian_id)}
                        label="Ward of"
                        familyId={familyId}
                        personId={personId}
                        canEdit={access.canEdit && !person.archived_at}
                      />
                    ))}
                  </ul>
                )}
                {access.canEdit && !person.archived_at && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Add a guardianship
                    </summary>
                    <div className="mt-3">
                      <AddGuardianshipForm familyId={familyId} person={person} people={activePeople} />
                    </div>
                  </details>
                )}
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alternate names</CardTitle>
              <CardDescription>
                Maiden names, nicknames, aliases, and alternate spellings are searchable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {nameRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alternate names recorded.</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {nameRows.map((name) => (
                    <NameRow
                      key={name.id}
                      name={name}
                      familyId={familyId}
                      personId={personId}
                      canEdit={access.canEdit && !person.archived_at}
                    />
                  ))}
                </ul>
              )}
              {access.canEdit && !person.archived_at && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Add an alternate name
                  </summary>
                  <ActionForm
                    action={addNameAction}
                    submitLabel="Add name"
                    pendingLabel="Adding…"
                    variant="outline"
                    className="mt-3 space-y-3 rounded-lg border border-border p-4"
                  >
                    <input type="hidden" name="familyId" value={familyId} />
                    <input type="hidden" name="personId" value={personId} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name" htmlFor="alternate-name" required>
                        <Input id="alternate-name" name="name" required maxLength={200} />
                      </Field>
                      <Field label="Type" htmlFor="alternate-name-type">
                        <select
                          id="alternate-name-type"
                          name="nameType"
                          className={selectClassName}
                          defaultValue="nickname"
                        >
                          {Object.entries(nameTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </ActionForm>
                </details>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" /> Profile and account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {person.is_claimed ? (
                <p className="text-muted-foreground">
                  This profile is linked to a family account. The account does not
                  receive extra workspace permissions.
                </p>
              ) : person.life_status === "living" && !person.archived_at ? (
                <p className="text-muted-foreground">
                  This living-person profile is not linked to an account yet.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Account linking is only available for living-person profiles.
                </p>
              )}

              {linkedToMe && (
                <p className="rounded-lg bg-primary/6 p-3 text-primary">
                  This profile is linked to your account.
                </p>
              )}

              {myPendingClaim && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="font-medium">Claim pending</p>
                  {myPendingClaim.message && (
                    <p className="text-xs text-muted-foreground">{myPendingClaim.message}</p>
                  )}
                  <ActionForm
                    action={withdrawPersonClaimAction}
                    submitLabel="Withdraw claim"
                    pendingLabel="Withdrawing…"
                    variant="outline"
                    size="sm"
                    className="space-y-2"
                  >
                    <input type="hidden" name="familyId" value={familyId} />
                    <input type="hidden" name="personId" value={personId} />
                    <input type="hidden" name="claimId" value={myPendingClaim.id} />
                  </ActionForm>
                </div>
              )}

              {canRequestClaim && (
                <details>
                  <summary className="cursor-pointer font-medium text-primary">
                    This is me — request a link
                  </summary>
                  <ActionForm
                    action={requestPersonClaimAction}
                    submitLabel="Request claim"
                    pendingLabel="Requesting…"
                    className="mt-3 space-y-3"
                  >
                    <input type="hidden" name="familyId" value={familyId} />
                    <input type="hidden" name="personId" value={personId} />
                    <Field
                      label="Note to the owner or admin"
                      htmlFor="claim-message"
                      hint="Optional. A sentence to help them verify your connection."
                    >
                      <Textarea
                        id="claim-message"
                        name="message"
                        rows={3}
                        maxLength={1000}
                        placeholder="I am Elena's grandson, Mateo."
                      />
                    </Field>
                  </ActionForm>
                </details>
              )}
            </CardContent>
          </Card>

          {access.canEdit && !person.archived_at && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Archive this person</CardTitle>
                <CardDescription>
                  Archiving hides the person from the tree and directory but preserves
                  relationships and history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm
                  action={archivePersonAction}
                  submitLabel="Archive person"
                  pendingLabel="Archiving…"
                  variant="destructive"
                  size="sm"
                  confirmMessage={`Archive ${person.display_name}? Their history is preserved.`}
                  className="space-y-3"
                >
                  <input type="hidden" name="familyId" value={familyId} />
                  <input type="hidden" name="personId" value={personId} />
                </ActionForm>
              </CardContent>
            </Card>
          )}

          {access.canManage && person.archived_at && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Restore this person</CardTitle>
                <CardDescription>
                  Restoring makes the person visible in the tree and directory again.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm
                  action={restorePersonAction}
                  submitLabel="Restore person"
                  pendingLabel="Restoring…"
                  variant="outline"
                  size="sm"
                  className="space-y-3"
                >
                  <input type="hidden" name="familyId" value={familyId} />
                  <input type="hidden" name="personId" value={personId} />
                </ActionForm>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Archive className="size-4 text-primary" /> Record information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>Created {new Date(person.created_at).toLocaleDateString()}</p>
              <p>Last updated {new Date(person.updated_at).toLocaleString()}</p>
              <p>Record version {person.version}</p>
              <p className="flex items-center gap-1.5">
                <RotateCcw className="size-3.5" /> Archive rather than delete to keep history.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function GuardianshipRow({
  edge,
  person,
  label,
  familyId,
  personId,
  canEdit,
}: {
  edge: Guardianship;
  person: Person | undefined;
  label: string;
  familyId: string;
  personId: string;
  canEdit: boolean;
}) {
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <PersonInline person={person} />
        <Badge variant="outline">{guardianshipTypeLabels[edge.guardianship_type]}</Badge>
      </div>
      <div className="mt-1">
        <RelationshipDates
          start={edge.start_date}
          startPrecision={edge.start_date_precision}
          end={edge.end_date}
          endPrecision={edge.end_date_precision}
        />
      </div>
      {edge.notes && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{edge.notes}</p>
      )}
      {canEdit && !edge.end_date && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-primary">
            End this guardianship
          </summary>
          <EndGuardianshipForm familyId={familyId} personId={personId} recordId={edge.id} />
        </details>
      )}
    </li>
  );
}

function NameRow({
  name,
  familyId,
  personId,
  canEdit,
}: {
  name: PersonName;
  familyId: string;
  personId: string;
  canEdit: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <div>
        <span>{name.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {nameTypeLabels[name.name_type]}
        </span>
      </div>
      {canEdit && (
        <ActionForm
          action={removeNameAction}
          submitLabel="Remove"
          pendingLabel="Removing…"
          variant="ghost"
          size="sm"
          className="inline-flex"
        >
          <input type="hidden" name="familyId" value={familyId} />
          <input type="hidden" name="personId" value={personId} />
          <input type="hidden" name="nameId" value={name.id} />
        </ActionForm>
      )}
    </li>
  );
}
