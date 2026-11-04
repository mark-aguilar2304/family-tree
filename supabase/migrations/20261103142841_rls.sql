alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invitations enable row level security;
alter table public.persons enable row level security;
alter table public.person_names enable row level security;
alter table public.parent_child_relationships enable row level security;
alter table public.partnerships enable row level security;
alter table public.partnership_participants enable row level security;
alter table public.guardianships enable row level security;
alter table public.person_claims enable row level security;
alter table public.person_account_links enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limit_events enable row level security;

-- Profiles are visible only to the owner and to people who share a workspace.
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.shares_family_with(id));

create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = auth.uid());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Workspace reads are member-only. All writes go through validated RPCs.
create policy families_select_member on public.families
for select to authenticated
using (public.is_family_member(id));

create policy family_members_select_member on public.family_members
for select to authenticated
using (public.is_family_member(family_id));

create policy invitations_select_admin on public.invitations
for select to authenticated
using (public.can_administer_family(family_id));

-- People are readable by every workspace member and writable by contributors
-- and above. Hard deletion is intentionally not exposed.
create policy persons_select_member on public.persons
for select to authenticated
using (public.is_family_member(family_id));

create policy persons_insert_editor on public.persons
for insert to authenticated
with check (public.can_edit_family(family_id) and created_by = auth.uid());

create policy persons_update_editor on public.persons
for update to authenticated
using (public.can_edit_family(family_id))
with check (public.can_edit_family(family_id));

create policy person_names_select_member on public.person_names
for select to authenticated
using (public.is_family_member(family_id));

create policy person_names_insert_editor on public.person_names
for insert to authenticated
with check (public.can_edit_family(family_id));

create policy person_names_update_editor on public.person_names
for update to authenticated
using (public.can_edit_family(family_id))
with check (public.can_edit_family(family_id));

create policy person_names_delete_editor on public.person_names
for delete to authenticated
using (public.can_edit_family(family_id));

create policy parentage_select_member on public.parent_child_relationships
for select to authenticated
using (public.is_family_member(family_id));

create policy parentage_insert_editor on public.parent_child_relationships
for insert to authenticated
with check (public.can_edit_family(family_id));

create policy parentage_update_editor on public.parent_child_relationships
for update to authenticated
using (public.can_edit_family(family_id))
with check (public.can_edit_family(family_id));

create policy parentage_delete_manager on public.parent_child_relationships
for delete to authenticated
using (public.can_manage_family(family_id));

create policy partnerships_select_member on public.partnerships
for select to authenticated
using (public.is_family_member(family_id));

create policy partnerships_update_editor on public.partnerships
for update to authenticated
using (public.can_edit_family(family_id))
with check (public.can_edit_family(family_id));

create policy partnerships_delete_manager on public.partnerships
for delete to authenticated
using (public.can_manage_family(family_id));

create policy partnership_participants_select_member on public.partnership_participants
for select to authenticated
using (public.is_family_member(family_id));

create policy guardianships_select_member on public.guardianships
for select to authenticated
using (public.is_family_member(family_id));

create policy guardianships_insert_editor on public.guardianships
for insert to authenticated
with check (public.can_edit_family(family_id));

create policy guardianships_update_editor on public.guardianships
for update to authenticated
using (public.can_edit_family(family_id))
with check (public.can_edit_family(family_id));

create policy guardianships_delete_manager on public.guardianships
for delete to authenticated
using (public.can_manage_family(family_id));

create policy person_claims_select_own_or_admin on public.person_claims
for select to authenticated
using (user_id = auth.uid() or public.can_administer_family(family_id));

create policy person_account_links_select_own_or_admin on public.person_account_links
for select to authenticated
using (user_id = auth.uid() or public.can_administer_family(family_id));

create policy audit_logs_select_admin on public.audit_logs
for select to authenticated
using (public.can_administer_family(family_id));

-- Least-privilege table grants. RLS is the second boundary, not the only one.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.families to authenticated;
grant select on public.family_members to authenticated;
grant select on public.invitations to authenticated;
grant select, insert, update on public.persons to authenticated;
grant select, insert, update, delete on public.person_names to authenticated;
grant select, insert, update, delete on public.parent_child_relationships to authenticated;
grant select, update, delete on public.partnerships to authenticated;
grant select on public.partnership_participants to authenticated;
grant select, insert, update, delete on public.guardianships to authenticated;
grant select on public.person_claims to authenticated;
grant select on public.person_account_links to authenticated;
grant select on public.audit_logs to authenticated;
