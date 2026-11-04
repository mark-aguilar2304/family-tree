-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. The
-- trigger and internal helper functions below are not client RPCs, so remove
-- that exposure. Triggers keep working: PostgreSQL checks EXECUTE when the
-- trigger is created, not when it fires.

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.audit_trigger() from public, anon, authenticated;
revoke all on function public.ensure_family_owner_consistency() from public, anon, authenticated;
revoke all on function public.prepare_person_write() from public, anon, authenticated;
revoke all on function public.prepare_person_name() from public, anon, authenticated;
revoke all on function public.prepare_parentage() from public, anon, authenticated;
revoke all on function public.prepare_partnership() from public, anon, authenticated;
revoke all on function public.prepare_partnership_participant() from public, anon, authenticated;
revoke all on function public.ensure_partnership_has_two_participants() from public, anon, authenticated;
revoke all on function public.prepare_guardianship() from public, anon, authenticated;
revoke all on function public.prepare_person_claim() from public, anon, authenticated;
revoke all on function public.prepare_person_link() from public, anon, authenticated;
revoke all on function public.sync_person_claimed() from public, anon, authenticated;

-- Pure validation helper used by CHECK constraints; authenticated writers
-- must still be able to execute it.
revoke all on function public.is_valid_partial_date(text, public.date_precision) from public, anon;
grant execute on function public.is_valid_partial_date(text, public.date_precision) to authenticated, service_role;
