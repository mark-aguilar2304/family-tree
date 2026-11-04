-- Evaluate auth.uid() once per statement instead of once per row. This is a
-- behavior-preserving performance fix recommended by Supabase's advisor.

alter policy profiles_select on public.profiles
using (id = (select auth.uid()) or public.shares_family_with(id));

alter policy profiles_insert_self on public.profiles
with check (id = (select auth.uid()));

alter policy profiles_update_self on public.profiles
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

alter policy persons_insert_editor on public.persons
with check (public.can_edit_family(family_id) and created_by = (select auth.uid()));

alter policy person_claims_select_own_or_admin on public.person_claims
using (user_id = (select auth.uid()) or public.can_administer_family(family_id));

alter policy person_account_links_select_own_or_admin on public.person_account_links
using (user_id = (select auth.uid()) or public.can_administer_family(family_id));
