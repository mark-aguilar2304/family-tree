-- Narrow, transactional domain operations. Every function validates the
-- caller, the workspace role, and workspace ownership of referenced records.

create or replace function public.create_family(
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_family_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'invalid_family_name';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'invalid_family_description';
  end if;

  insert into public.families (name, description, owner_id)
  values (v_name, v_description, v_actor)
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (v_family_id, v_actor, 'owner');

  return v_family_id;
end;
$$;

create or replace function public.update_family(
  p_family_id uuid,
  p_name text,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_description text := nullif(trim(coalesce(p_description, '')), '');
begin
  if not public.can_manage_family(p_family_id) then
    raise exception 'not_authorized';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'invalid_family_name';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'invalid_family_description';
  end if;

  update public.families
  set name = v_name, description = v_description
  where id = p_family_id;
end;
$$;

create or replace function public.archive_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'not_authorized';
  end if;
  update public.families
  set archived_at = coalesce(archived_at, now())
  where id = p_family_id;
end;
$$;

create or replace function public.restore_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'not_authorized';
  end if;
  update public.families
  set archived_at = null
  where id = p_family_id;
end;
$$;

create or replace function public.transfer_ownership(
  p_family_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target_role public.family_role;
begin
  if not public.is_family_owner(p_family_id) then
    raise exception 'not_authorized';
  end if;
  if p_new_owner_id = v_actor then
    raise exception 'already_owner';
  end if;

  select role into v_target_role
  from public.family_members
  where family_id = p_family_id and user_id = p_new_owner_id;

  if v_target_role is null then
    raise exception 'target_not_member';
  end if;

  update public.families
  set owner_id = p_new_owner_id
  where id = p_family_id;

  update public.family_members
  set role = 'admin'
  where family_id = p_family_id and user_id = v_actor;

  update public.family_members
  set role = 'owner'
  where family_id = p_family_id and user_id = p_new_owner_id;
end;
$$;

create or replace function public.leave_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.family_role;
begin
  select role into v_role
  from public.family_members
  where family_id = p_family_id and user_id = v_actor;

  if v_role is null then
    raise exception 'not_a_member';
  end if;
  if v_role = 'owner' then
    raise exception 'owner_must_transfer';
  end if;

  delete from public.family_members
  where family_id = p_family_id and user_id = v_actor;
end;
$$;

create or replace function public.change_member_role(
  p_family_id uuid,
  p_user_id uuid,
  p_role public.family_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.family_role;
  v_target_role public.family_role;
begin
  if not public.can_manage_family(p_family_id) then
    raise exception 'not_authorized';
  end if;
  if p_role = 'owner' then
    raise exception 'owner_role_requires_transfer';
  end if;
  if p_user_id = v_actor then
    raise exception 'cannot_change_own_role';
  end if;

  select role into v_target_role
  from public.family_members
  where family_id = p_family_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'target_not_member';
  end if;
  if v_target_role = 'owner' then
    raise exception 'cannot_change_owner';
  end if;

  v_actor_role := public.family_role(p_family_id);
  if v_actor_role = 'admin' and (v_target_role = 'admin' or p_role = 'admin') then
    raise exception 'admin_role_change_limited';
  end if;

  update public.family_members
  set role = p_role
  where family_id = p_family_id and user_id = p_user_id;
end;
$$;

create or replace function public.remove_member(
  p_family_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.family_role;
  v_target_role public.family_role;
begin
  if not public.can_manage_family(p_family_id) then
    raise exception 'not_authorized';
  end if;
  if p_user_id = v_actor then
    raise exception 'cannot_remove_self';
  end if;

  select role into v_target_role
  from public.family_members
  where family_id = p_family_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'target_not_member';
  end if;
  if v_target_role = 'owner' then
    raise exception 'cannot_remove_owner';
  end if;

  v_actor_role := public.family_role(p_family_id);
  if v_actor_role = 'admin' and v_target_role = 'admin' then
    raise exception 'admin_remove_limited';
  end if;

  delete from public.family_members
  where family_id = p_family_id and user_id = p_user_id;
end;
$$;

create or replace function public.create_partnership(
  p_family_id uuid,
  p_participant_ids uuid[],
  p_partnership_type public.partnership_type,
  p_status public.partnership_status,
  p_start_date text default null,
  p_start_date_precision public.date_precision default 'unknown',
  p_end_date text default null,
  p_end_date_precision public.date_precision default 'unknown',
  p_location text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_count integer;
  v_distinct_count integer;
  v_partnership_id uuid;
begin
  if not public.can_edit_family(p_family_id) then
    raise exception 'not_authorized';
  end if;
  if p_participant_ids is null then
    raise exception 'partnership_requires_two_participants';
  end if;

  v_participant_count := coalesce(array_length(p_participant_ids, 1), 0);
  select count(distinct participant_id)::integer into v_distinct_count
  from unnest(p_participant_ids) as participant_id;

  if v_participant_count < 2 or v_distinct_count <> v_participant_count then
    raise exception 'partnership_requires_two_participants';
  end if;

  if exists (
    select 1
    from unnest(p_participant_ids) as participant_id
    left join public.persons p
      on p.id = participant_id
     and p.family_id = p_family_id
     and p.archived_at is null
    where p.id is null
  ) then
    raise exception 'person_not_found';
  end if;

  insert into public.partnerships (
    family_id, partnership_type, status,
    start_date, start_date_precision, end_date, end_date_precision,
    location, notes
  ) values (
    p_family_id, p_partnership_type, p_status,
    nullif(trim(coalesce(p_start_date, '')), ''),
    p_start_date_precision,
    nullif(trim(coalesce(p_end_date, '')), ''),
    p_end_date_precision,
    nullif(trim(coalesce(p_location, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_partnership_id;

  insert into public.partnership_participants (partnership_id, person_id)
  select v_partnership_id, participant_id
  from unnest(p_participant_ids) as participant_id;

  return v_partnership_id;
end;
$$;

create or replace function public.add_partnership_participant(
  p_partnership_id uuid,
  p_person_id uuid,
  p_participant_role text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_id uuid;
begin
  select family_id into v_family_id
  from public.partnerships where id = p_partnership_id;

  if v_family_id is null then
    raise exception 'partnership_not_found';
  end if;
  if not public.can_edit_family(v_family_id) then
    raise exception 'not_authorized';
  end if;

  insert into public.partnership_participants (
    partnership_id, person_id, participant_role
  ) values (
    p_partnership_id, p_person_id, nullif(trim(coalesce(p_participant_role, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.remove_partnership_participant(
  p_partnership_id uuid,
  p_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id
  from public.partnerships where id = p_partnership_id;

  if v_family_id is null then
    raise exception 'partnership_not_found';
  end if;
  if not public.can_edit_family(v_family_id) then
    raise exception 'not_authorized';
  end if;

  delete from public.partnership_participants
  where partnership_id = p_partnership_id and person_id = p_person_id;
end;
$$;

create or replace function public.request_person_claim(
  p_family_id uuid,
  p_person_id uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_person public.persons%rowtype;
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not_authorized';
  end if;

  select * into v_person
  from public.persons
  where id = p_person_id and family_id = p_family_id;

  if not found then
    raise exception 'person_not_found';
  end if;
  if v_person.archived_at is not null then
    raise exception 'person_archived';
  end if;
  if v_person.life_status <> 'living' then
    raise exception 'claim_requires_living_person';
  end if;
  if exists (select 1 from public.person_account_links where person_id = p_person_id) then
    raise exception 'person_already_claimed';
  end if;
  if exists (
    select 1 from public.person_account_links
    where family_id = p_family_id and user_id = v_actor
  ) then
    raise exception 'account_already_linked_in_workspace';
  end if;
  if exists (
    select 1 from public.person_claims
    where person_id = p_person_id and user_id = v_actor and status = 'pending'
  ) then
    raise exception 'claim_already_pending';
  end if;

  insert into public.person_claims (family_id, person_id, user_id, message)
  values (
    p_family_id,
    p_person_id,
    v_actor,
    nullif(trim(coalesce(p_message, '')), '')
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'claim_already_pending';
end;
$$;

create or replace function public.resolve_person_claim(
  p_claim_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_claim public.person_claims%rowtype;
  v_person public.persons%rowtype;
begin
  select * into v_claim
  from public.person_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim_not_found';
  end if;
  if not public.can_manage_family(v_claim.family_id) then
    raise exception 'not_authorized';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'claim_not_pending';
  end if;

  if p_approve then
    select * into v_person
    from public.persons
    where id = v_claim.person_id and family_id = v_claim.family_id;

    if not found then
      raise exception 'person_not_found';
    end if;
    if v_person.archived_at is not null then
      raise exception 'person_archived';
    end if;
    if v_person.life_status <> 'living' then
      raise exception 'claim_requires_living_person';
    end if;
    if exists (select 1 from public.person_account_links where person_id = v_claim.person_id) then
      raise exception 'person_already_claimed';
    end if;

    insert into public.person_account_links (
      family_id, person_id, user_id, approved_by
    ) values (
      v_claim.family_id, v_claim.person_id, v_claim.user_id, v_actor
    );

    update public.person_claims
    set status = 'approved', resolved_by = v_actor, resolved_at = now()
    where id = p_claim_id;

    update public.person_claims
    set status = 'rejected', resolved_by = v_actor, resolved_at = now()
    where person_id = v_claim.person_id
      and status = 'pending'
      and id <> p_claim_id;
  else
    update public.person_claims
    set status = 'rejected', resolved_by = v_actor, resolved_at = now()
    where id = p_claim_id;
  end if;
end;
$$;

create or replace function public.withdraw_person_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_claim public.person_claims%rowtype;
begin
  select * into v_claim
  from public.person_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim_not_found';
  end if;
  if v_claim.user_id <> v_actor then
    raise exception 'not_authorized';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'claim_not_pending';
  end if;

  update public.person_claims
  set status = 'withdrawn', resolved_at = now()
  where id = p_claim_id;
end;
$$;

revoke all on function public.create_family(text, text) from public, anon;
revoke all on function public.update_family(uuid, text, text) from public, anon;
revoke all on function public.archive_family(uuid) from public, anon;
revoke all on function public.restore_family(uuid) from public, anon;
revoke all on function public.transfer_ownership(uuid, uuid) from public, anon;
revoke all on function public.leave_family(uuid) from public, anon;
revoke all on function public.change_member_role(uuid, uuid, public.family_role) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.create_partnership(uuid, uuid[], public.partnership_type, public.partnership_status, text, public.date_precision, text, public.date_precision, text, text) from public, anon;
revoke all on function public.add_partnership_participant(uuid, uuid, text) from public, anon;
revoke all on function public.remove_partnership_participant(uuid, uuid) from public, anon;
revoke all on function public.request_person_claim(uuid, uuid, text) from public, anon;
revoke all on function public.resolve_person_claim(uuid, boolean) from public, anon;
revoke all on function public.withdraw_person_claim(uuid) from public, anon;

grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.update_family(uuid, text, text) to authenticated;
grant execute on function public.archive_family(uuid) to authenticated;
grant execute on function public.restore_family(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.leave_family(uuid) to authenticated;
grant execute on function public.change_member_role(uuid, uuid, public.family_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.create_partnership(uuid, uuid[], public.partnership_type, public.partnership_status, text, public.date_precision, text, public.date_precision, text, text) to authenticated;
grant execute on function public.add_partnership_participant(uuid, uuid, text) to authenticated;
grant execute on function public.remove_partnership_participant(uuid, uuid) to authenticated;
grant execute on function public.request_person_claim(uuid, uuid, text) to authenticated;
grant execute on function public.resolve_person_claim(uuid, boolean) to authenticated;
grant execute on function public.withdraw_person_claim(uuid) to authenticated;
