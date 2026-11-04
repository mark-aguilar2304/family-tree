/**
 * Local PostgreSQL RLS and domain-integrity tests.
 *
 * PGlite is a real PostgreSQL engine compiled to WASM. We stub only the
 * Supabase-owned auth/storage schemas and exercise the committed migrations
 * with real RLS policies, triggers, constraints, and SECURITY DEFINER RPCs.
 *
 * This suite is not a substitute for a smoke test against the hosted project,
 * but it catches cross-workspace access, role escalation, and relationship
 * integrity regressions without requiring Docker.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

type User = { id: string; email: string };
type Row = Record<string, unknown>;

const migrations = [
  "20261103142831_core.sql",
  "20261103142834_invitations.sql",
  "20261103142838_genealogy.sql",
  "20261103142841_rls.sql",
  "20261103142844_rpc.sql",
  "20261103143229_function_grants.sql",
  "20261103143311_rls_initplan.sql",
];

let db: PGlite;
let passed = 0;

async function main() {
  db = new PGlite();
  await bootstrapSupabaseStubs();
  for (const file of migrations) {
    await db.exec(readFileSync(join("supabase", "migrations", file), "utf8"));
  }
  await db.exec("reset role;");

  await test("RLS: a user only sees workspaces they belong to", async () => {
    const owner = await createUser("owner@example.com");
    const outsider = await createUser("outsider@example.com");
    const familyId = await createFamily(owner, "The Rivera Family");

    await actAs(owner);
    assert.equal(await count("select count(*)::int as n from public.families"), 1);
    assert.equal(await count("select count(*)::int as n from public.family_members"), 1);

    await actAs(outsider);
    assert.equal(await count("select count(*)::int as n from public.families"), 0);
    assert.equal(await count("select count(*)::int as n from public.families where id = $1", [familyId]), 0);
    await expectError(
      () => db.query("insert into public.persons (family_id, display_name, life_status) values ($1, 'Intruder', 'unknown')", [familyId]),
      /row-level security/i,
    );
  });

  await test("RLS: membership grants read access but viewers cannot write", async () => {
    const owner = await createUser("owner2@example.com");
    const relative = await createUser("relative@example.com");
    const familyId = await createFamily(owner, "Hernandez Family");
    const personId = await createPerson(owner, familyId, "Elena Hernandez", "living");

    const token = randomToken();
    await actAs(owner);
    await db.query(
      "select public.create_invitation($1, $2, 'contributor'::public.family_role, $3, now() + interval '7 days')",
      [familyId, relative.email, hashToken(token)],
    );

    await actAs(relative);
    const accepted = await rows<{ family_id: string }>("select public.accept_invitation($1) as family_id", [token]);
    assert.equal(accepted[0]?.family_id, familyId);
    assert.equal(await count("select count(*)::int as n from public.persons where id = $1", [personId]), 1);
    assert.equal(await count("select count(*)::int as n from public.families where id = $1", [familyId]), 1);

    const newPerson = await createPerson(relative, familyId, "Mateo Hernandez", "unknown");
    assert.ok(newPerson);

    await actAs(owner);
    await db.query("select public.change_member_role($1, $2, 'viewer'::public.family_role)", [familyId, relative.id]);

    await actAs(relative);
    await expectError(
      () => db.query("insert into public.persons (family_id, display_name, life_status) values ($1, 'Blocked', 'unknown')", [familyId]),
      /row-level security/i,
    );
    assert.equal(await count("select count(*)::int as n from public.persons where id = $1", [personId]), 1);
  });

  await test("RLS: contributors cannot manage invitations or members", async () => {
    const owner = await createUser("owner3@example.com");
    const contributor = await createUser("contributor@example.com");
    const familyId = await createFamily(owner, "Nakamura Family");
    await inviteAndAccept(owner, familyId, contributor, "contributor");

    await actAs(contributor);
    await expectError(
      () => db.query(
        "select public.create_invitation($1, 'new@example.com', 'viewer'::public.family_role, $2, now() + interval '7 days')",
        [familyId, hashToken(randomToken())],
      ),
      /not_authorized/,
    );
    await expectError(
      () => db.query("select public.change_member_role($1, $2, 'viewer'::public.family_role)", [familyId, contributor.id]),
      /not_authorized/,
    );
  });

  await test("RBAC: admins cannot grant admin or transfer ownership", async () => {
    const owner = await createUser("owner4@example.com");
    const admin = await createUser("admin@example.com");
    const familyId = await createFamily(owner, "Okafor Family");
    await inviteAndAccept(owner, familyId, admin, "admin");

    await actAs(admin);
    await expectError(
      () => db.query(
        "select public.create_invitation($1, 'another@example.com', 'admin'::public.family_role, $2, now() + interval '7 days')",
        [familyId, hashToken(randomToken())],
      ),
      /admin_cannot_invite_admin/,
    );
    await expectError(
      () => db.query("select public.transfer_ownership($1, $2)", [familyId, admin.id]),
      /not_authorized/,
    );
  });

  await test("invitations: hash-only storage, single use, revocation, expiry", async () => {
    const owner = await createUser("owner5@example.com");
    const invited = await createUser("invited@example.com");
    const revokedUser = await createUser("revoked@example.com");
    const expiredUser = await createUser("expired@example.com");
    const familyId = await createFamily(owner, "Silva Family");

    const token = randomToken();
    await actAs(owner);
    const inviteId = await scalar<string>(
      "select public.create_invitation($1, $2, 'viewer'::public.family_role, $3, now() + interval '7 days')",
      [familyId, invited.email, hashToken(token)],
    );

    await admin();
    const stored = await rows<{ token_hash: string }>("select token_hash from public.invitations where id = $1", [inviteId]);
    assert.equal(stored[0]?.token_hash, hashToken(token));
    assert.notEqual(stored[0]?.token_hash, token);
    assert.equal(stored[0]?.token_hash.length, 64);

    await actAs(invited);
    assert.equal((await rows<{ family_id: string }>("select public.accept_invitation($1) as family_id", [token]))[0]?.family_id, familyId);
    assert.equal((await rows<{ family_id: string }>("select public.accept_invitation($1) as family_id", [token]))[0]?.family_id, familyId);

    await actAs(owner);
    await expectError(
      () => db.query(
        "select public.create_invitation($1, $2, 'viewer'::public.family_role, $3, now() + interval '7 days')",
        [familyId, invited.email, hashToken(randomToken())],
      ),
      /already_member/,
    );

    const revokedToken = randomToken();
    const revokedInvite = await scalar<string>(
      "select public.create_invitation($1, $2, 'viewer'::public.family_role, $3, now() + interval '7 days')",
      [familyId, revokedUser.email, hashToken(revokedToken)],
    );
    await db.query("select public.revoke_invitation($1)", [revokedInvite]);
    await actAs(revokedUser);
    await expectError(() => db.query("select public.accept_invitation($1)", [revokedToken]), /invitation_revoked/);

    const expiredToken = randomToken();
    await actAs(owner);
    const expiredInvite = await scalar<string>(
      "select public.create_invitation($1, $2, 'viewer'::public.family_role, $3, now() + interval '7 days')",
      [familyId, expiredUser.email, hashToken(expiredToken)],
    );
    await admin();
    await db.query("update public.invitations set expires_at = now() - interval '1 day' where id = $1", [expiredInvite]);
    await actAs(expiredUser);
    await expectError(() => db.query("select public.accept_invitation($1)", [expiredToken]), /invitation_expired/);
  });

  await test("parentage: self, duplicate, cross-workspace, and ancestry cycles reject", async () => {
    const owner = await createUser("owner6@example.com");
    const outsider = await createUser("outsider6@example.com");
    const familyId = await createFamily(owner, "Rossi Family");
    const otherFamilyId = await createFamily(outsider, "Other Family");
    const otherPerson = await createPerson(outsider, otherFamilyId, "Other Person", "unknown");

    const a = await createPerson(owner, familyId, "Ada Rossi", "deceased");
    const b = await createPerson(owner, familyId, "Bruno Rossi", "living");
    const c = await createPerson(owner, familyId, "Carla Rossi", "living");

    await actAs(owner);
    await expectError(
      () => db.query("insert into public.parent_child_relationships (family_id, parent_id, child_id, parentage_type) values ($1, $2, $2, 'biological')", [familyId, a]),
      /self_parentage/,
    );
    await db.query("insert into public.parent_child_relationships (family_id, parent_id, child_id, parentage_type) values ($1, $2, $3, 'biological')", [familyId, a, b]);
    await db.query("insert into public.parent_child_relationships (family_id, parent_id, child_id, parentage_type) values ($1, $2, $3, 'adoptive')", [familyId, b, c]);

    await expectError(
      () => db.query("insert into public.parent_child_relationships (family_id, parent_id, child_id, parentage_type) values ($1, $2, $3, 'biological')", [familyId, c, a]),
      /ancestry_cycle/,
    );
    await expectError(
      () => db.query("insert into public.parent_child_relationships (family_id, parent_id, child_id, parentage_type) values ($1, $2, $3, 'biological')", [familyId, a, b]),
      /duplicate key|unique/i,
    );
    await expectError(
      () => db.query("insert into public.parent_child_relationships (family_id, parent_id, child_id, parentage_type) values ($1, $2, $3, 'legal')", [familyId, a, otherPerson]),
      /cross_workspace_relationship|row-level security/i,
    );

    // Ending a relationship preserves history and permits a new active record.
    await db.query("update public.parent_child_relationships set end_date = '2000' , end_date_precision = 'year' where parent_id = $1 and child_id = $2 and parentage_type = 'biological'", [a, b]);
    await db.query("insert into public.parent_child_relationships (family_id, parent_id, child_id, parentage_type) values ($1, $2, $3, 'biological')", [familyId, a, b]);
    assert.equal(await count("select count(*)::int as n from public.parent_child_relationships where parent_id = $1 and child_id = $2", [a, b]), 2);
  });

  await test("partnerships: multiple participants, self-link prevention, historical statuses", async () => {
    const owner = await createUser("owner7@example.com");
    const outsider = await createUser("outsider7@example.com");
    const familyId = await createFamily(owner, "Bianchi Family");
    const otherFamilyId = await createFamily(outsider, "Elsewhere");
    const a = await createPerson(owner, familyId, "Luca Bianchi", "living");
    const b = await createPerson(owner, familyId, "Sofia Bianchi", "living");
    const c = await createPerson(owner, familyId, "Marco Bianchi", "living");
    const other = await createPerson(outsider, otherFamilyId, "Stranger", "unknown");

    await actAs(owner);
    const partnershipId = await scalar<string>(
      "select public.create_partnership($1, array[$2, $3]::uuid[], 'marriage'::public.partnership_type, 'current'::public.partnership_status)",
      [familyId, a, b],
    );
    assert.equal(await count("select count(*)::int as n from public.partnership_participants where partnership_id = $1", [partnershipId]), 2);

    await db.query(
      "update public.partnerships set status = 'divorced'::public.partnership_status, end_date = '2010', end_date_precision = 'year' where id = $1",
      [partnershipId],
    );
    assert.equal(await count("select count(*)::int as n from public.partnerships where id = $1 and status = 'divorced'", [partnershipId]), 1);

    await expectError(
      () => db.query("select public.create_partnership($1, array[$2, $2]::uuid[], 'other'::public.partnership_type, 'unknown'::public.partnership_status)", [familyId, a]),
      /partnership_requires_two_participants/,
    );
    await expectError(
      () => db.query("select public.create_partnership($1, array[$2, $3]::uuid[], 'other'::public.partnership_type, 'unknown'::public.partnership_status)", [familyId, a, other]),
      /person_not_found/,
    );
    await expectError(
      () => db.query("select public.remove_partnership_participant($1, $2)", [partnershipId, a]),
      /partnership_requires_two_participants/,
    );

    const thirdId = await scalar<string>(
      "select public.create_partnership($1, array[$2, $3, $4]::uuid[], 'other'::public.partnership_type, 'unknown'::public.partnership_status)",
      [familyId, a, b, c],
    );
    assert.equal(await count("select count(*)::int as n from public.partnership_participants where partnership_id = $1", [thirdId]), 3);
  });

  await test("guardianships: independent from parentage and cross-workspace safe", async () => {
    const owner = await createUser("owner8@example.com");
    const outsider = await createUser("outsider8@example.com");
    const familyId = await createFamily(owner, "Kowalski Family");
    const otherFamilyId = await createFamily(outsider, "Other");
    const guardian = await createPerson(owner, familyId, "Anna Kowalski", "living");
    const ward = await createPerson(owner, familyId, "Piotr Kowalski", "living");
    const stranger = await createPerson(outsider, otherFamilyId, "Stranger", "unknown");

    await actAs(owner);
    await expectError(
      () => db.query("insert into public.guardianships (family_id, guardian_id, ward_id, guardianship_type) values ($1, $2, $2, 'legal')", [familyId, guardian]),
      /self_guardianship/,
    );
    await expectError(
      () => db.query("insert into public.guardianships (family_id, guardian_id, ward_id, guardianship_type) values ($1, $2, $3, 'legal')", [familyId, guardian, stranger]),
      /cross_workspace_relationship|row-level security/i,
    );
    const id = await scalar<string>(
      "insert into public.guardianships (family_id, guardian_id, ward_id, guardianship_type) values ($1, $2, $3, 'legal') returning id",
      [familyId, guardian, ward],
    );
    await db.query("update public.guardianships set end_date = '2015', end_date_precision = 'year' where id = $1", [id]);
    assert.equal(await count("select count(*)::int as n from public.guardianships where id = $1 and end_date = '2015'", [id]), 1);
  });

  await test("claims: living-person approval links account without elevating role", async () => {
    const owner = await createUser("owner9@example.com");
    const claimant = await createUser("claimant@example.com");
    const outsider = await createUser("outsider9@example.com");
    const familyId = await createFamily(owner, "Mensah Family");
    await inviteAndAccept(owner, familyId, claimant, "contributor");
    const personId = await createPerson(owner, familyId, "Kofi Mensah", "living");
    await createPerson(owner, familyId, "Deceased Person", "deceased");

    await actAs(claimant);
    const claimId = await scalar<string>(
      "select public.request_person_claim($1, $2, 'This is me.')",
      [familyId, personId],
    );
    assert.equal(await count("select count(*)::int as n from public.person_claims where id = $1 and status = 'pending'", [claimId]), 1);

    await actAs(owner);
    await db.query("select public.resolve_person_claim($1, true)", [claimId]);
    assert.equal(await count("select count(*)::int as n from public.persons where id = $1 and is_claimed = true", [personId]), 1);
    assert.equal(await count("select count(*)::int as n from public.person_account_links where person_id = $1", [personId]), 1);

    await actAs(claimant);
    assert.equal(await count("select count(*)::int as n from public.person_account_links where person_id = $1", [personId]), 1);
    assert.equal(await count("select count(*)::int as n from public.family_members where family_id = $1 and user_id = $2 and role = 'contributor'", [familyId, claimant.id]), 1);

    await actAs(outsider);
    assert.equal(await count("select count(*)::int as n from public.person_account_links where person_id = $1", [personId]), 0);
    assert.equal(await count("select count(*)::int as n from public.persons where id = $1", [personId]), 0);
  });

  await test("search: display and alternative names, tenant-scoped", async () => {
    const owner = await createUser("owner10@example.com");
    const outsider = await createUser("outsider10@example.com");
    const familyId = await createFamily(owner, "Garcia Family");
    const personId = await createPerson(owner, familyId, "Rosa Garcia", "living");

    await actAs(owner);
    await db.query(
      "insert into public.person_names (family_id, person_id, name, name_type) values ($1, $2, 'Rosalita', 'nickname')",
      [familyId, personId],
    );
    assert.equal(await count("select count(*)::int as n from public.search_people($1, 'Rosa', 50, 0)", [familyId]), 1);
    assert.equal(await count("select count(*)::int as n from public.search_people($1, 'Rosalita', 50, 0)", [familyId]), 1);
    assert.equal(await count("select count(*)::int as n from public.search_people($1, 'Nobody', 50, 0)", [familyId]), 0);

    await actAs(outsider);
    assert.equal(await count("select count(*)::int as n from public.search_people($1, 'Rosa', 50, 0)", [familyId]), 0);
  });

  await test("profiles: shared-family visibility only", async () => {
    const a = await createUser("profile-a@example.com");
    const b = await createUser("profile-b@example.com");
    const c = await createUser("profile-c@example.com");
    const familyId = await createFamily(a, "Profile Family");
    await inviteAndAccept(a, familyId, b, "viewer");

    await actAs(a);
    assert.equal(await count("select count(*)::int as n from public.profiles where id = $1", [b.id]), 1);
    assert.equal(await count("select count(*)::int as n from public.profiles where id = $1", [c.id]), 0);
  });

  await test("audit: admins can read, contributors cannot", async () => {
    const owner = await createUser("owner11@example.com");
    const contributor = await createUser("contributor11@example.com");
    const familyId = await createFamily(owner, "Audit Family");
    await inviteAndAccept(owner, familyId, contributor, "contributor");
    await createPerson(owner, familyId, "Audited Person", "unknown");

    await actAs(owner);
    assert.ok((await count("select count(*)::int as n from public.audit_logs where family_id = $1", [familyId])) > 0);

    await actAs(contributor);
    assert.equal(await count("select count(*)::int as n from public.audit_logs where family_id = $1", [familyId]), 0);
  });

  await test("archived workspaces are read-only and restore is owner-only", async () => {
    const owner = await createUser("owner12@example.com");
    const contributor = await createUser("contributor12@example.com");
    const familyId = await createFamily(owner, "Archive Family");
    await inviteAndAccept(owner, familyId, contributor, "contributor");

    await actAs(owner);
    await db.query("select public.archive_family($1)", [familyId]);
    await expectError(
      () => db.query("insert into public.persons (family_id, display_name, life_status) values ($1, 'Blocked', 'unknown')", [familyId]),
      /row-level security/i,
    );
    assert.equal(await count("select count(*)::int as n from public.families where id = $1", [familyId]), 1);

    await actAs(contributor);
    await expectError(() => db.query("select public.restore_family($1)", [familyId]), /not_authorized/);

    await actAs(owner);
    await db.query("select public.restore_family($1)", [familyId]);
    await createPerson(owner, familyId, "Restored Person", "unknown");
    assert.equal(await count("select count(*)::int as n from public.persons where family_id = $1", [familyId]), 1);
  });

  await test("ownership: transfer is atomic and leaves exactly one owner", async () => {
    const owner = await createUser("owner13@example.com");
    const successor = await createUser("successor@example.com");
    const familyId = await createFamily(owner, "Transfer Family");
    await inviteAndAccept(owner, familyId, successor, "admin");

    await actAs(owner);
    await db.query("select public.transfer_ownership($1, $2)", [familyId, successor.id]);

    await admin();
    const owners = await rows<{ user_id: string; role: string }>(
      "select user_id, role::text as role from public.family_members where family_id = $1 and role = 'owner'",
      [familyId],
    );
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.user_id, successor.id);
    assert.equal(await count("select count(*)::int as n from public.families where id = $1 and owner_id = $2", [familyId, successor.id]), 1);
  });

  await test("people: optimistic version increments and restore is manager-only", async () => {
    const owner = await createUser("owner14@example.com");
    const contributor = await createUser("contributor14@example.com");
    const familyId = await createFamily(owner, "Version Family");
    await inviteAndAccept(owner, familyId, contributor, "contributor");
    const personId = await createPerson(contributor, familyId, "Versioned Person", "unknown");

    await actAs(contributor);
    const before = await rows<{ version: number }>("select version from public.persons where id = $1", [personId]);
    await db.query("update public.persons set biography = 'Updated' where id = $1 and version = $2", [personId, before[0]?.version]);
    const after = await rows<{ version: number }>("select version from public.persons where id = $1", [personId]);
    assert.equal(after[0]?.version, (before[0]?.version ?? 0) + 1);

    await db.query("update public.persons set archived_at = now() where id = $1", [personId]);
    await expectError(
      () => db.query("update public.persons set archived_at = null where id = $1", [personId]),
      /restore_requires_manager/,
    );

    await actAs(owner);
    await db.query("update public.persons set archived_at = null where id = $1", [personId]);
    assert.equal(await count("select count(*)::int as n from public.persons where id = $1 and archived_at is null", [personId]), 1);
  });

  await test("grants: internal trigger functions are not client-callable", async () => {
    const owner = await createUser("owner15@example.com");
    const familyId = await createFamily(owner, "Grant Family");

    await actAs(owner);
    await expectError(
      () => db.query("select public.prepare_person_write()"),
      /permission denied for function/i,
    );
    await expectError(
      () => db.query("select public.handle_new_user()"),
      /permission denied for function/i,
    );

    // Triggers still fire after EXECUTE is revoked, and the date CHECK helper
    // remains callable by authenticated writers.
    const personId = await scalar<string>(
      "insert into public.persons (family_id, display_name, life_status, birth_date, birth_date_precision) values ($1, 'Grant Person', 'unknown', '1900', 'year') returning id",
      [familyId],
    );
    await db.query("update public.persons set biography = 'Updated' where id = $1", [personId]);
    assert.equal(await count("select count(*)::int as n from public.persons where id = $1", [personId]), 1);

    await admin();
    await db.exec("set role anon;");
    await expectError(
      () => db.query("select public.audit_trigger()"),
      /permission denied for function/i,
    );
    await admin();
  });

  console.log(`\n${passed} RLS/domain tests passed.`);
  await db.close();
}

async function bootstrapSupabaseStubs() {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create or replace function auth.role() returns text
    language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
    $$;
    create or replace function auth.jwt() returns jsonb
    language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
  `);
}

async function createUser(email: string): Promise<User> {
  await admin();
  const id = randomUUID();
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)", [
    id,
    email,
    JSON.stringify({ full_name: email.split("@")[0] }),
  ]);
  return { id, email };
}

async function actAs(user: User) {
  await admin();
  await db.query(
    "select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claims', $2, false)",
    [user.id, JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" })],
  );
  await db.exec("set role authenticated;");
}

async function admin() {
  await db.exec("reset role;");
}

async function createFamily(owner: User, name: string): Promise<string> {
  await actAs(owner);
  const id = await scalar<string>("select public.create_family($1, null)", [name]);
  return id;
}

async function createPerson(owner: User, familyId: string, displayName: string, lifeStatus: string): Promise<string> {
  await actAs(owner);
  return scalar<string>(
    "insert into public.persons (family_id, display_name, life_status) values ($1, $2, $3::public.life_status) returning id",
    [familyId, displayName, lifeStatus],
  );
}

async function inviteAndAccept(owner: User, familyId: string, invitee: User, role: string) {
  const token = randomToken();
  await actAs(owner);
  await db.query(
    `select public.create_invitation($1, $2, $3::public.family_role, $4, now() + interval '7 days')`,
    [familyId, invitee.email, role, hashToken(token)],
  );
  await actAs(invitee);
  await db.query("select public.accept_invitation($1)", [token]);
}

async function rows<T extends Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query<T>(sql, params);
  return result.rows;
}

async function scalar<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await rows<Record<string, T>>(sql, params);
  const row = result[0];
  if (!row) {
    throw new Error(`Expected a row from: ${sql}`);
  }
  const value = Object.values(row)[0];
  if (value === undefined) {
    throw new Error(`Expected a value from: ${sql}`);
  }
  return value;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return scalar<number>(sql, params);
}

async function expectError(fn: () => Promise<unknown>, pattern: RegExp) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern);
    return;
  }
  throw new Error(`Expected an error matching ${pattern}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function randomToken(): string {
  return randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

main().catch(async (error) => {
  console.error(error);
  try {
    await db.close();
  } catch {
    // ignore close failures after a test failure
  }
  process.exit(1);
});
