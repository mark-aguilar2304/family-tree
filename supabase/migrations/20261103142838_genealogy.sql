-- People and relationships. Dates are stored as ISO partial strings plus a
-- precision enum so an approximate year is never silently turned into a date.

create or replace function public.is_valid_partial_date(
  p_value text,
  p_precision public.date_precision
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or p_value = '' then p_precision = 'unknown'
    when p_precision = 'exact' then p_value ~ '^\d{4}-\d{2}-\d{2}$'
    when p_precision = 'month' then p_value ~ '^\d{4}-\d{2}$'
    when p_precision = 'year' then p_value ~ '^\d{4}$'
    when p_precision = 'approximate' then p_value ~ '^\d{4}(-\d{2}(-\d{2})?)?$'
    else false
  end;
$$;

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  given_name text not null default '',
  middle_name text,
  surname text,
  suffix text,
  display_name text not null,
  gender text,
  biography text,
  birth_date text,
  birth_date_precision public.date_precision not null default 'unknown',
  birth_place text,
  death_date text,
  death_date_precision public.date_precision not null default 'unknown',
  death_place text,
  life_status public.life_status not null default 'unknown',
  is_claimed boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint persons_display_name_length check (char_length(trim(display_name)) between 1 and 200),
  constraint persons_given_name_length check (char_length(given_name) <= 120),
  constraint persons_middle_name_length check (middle_name is null or char_length(middle_name) <= 120),
  constraint persons_surname_length check (surname is null or char_length(surname) <= 120),
  constraint persons_suffix_length check (suffix is null or char_length(suffix) <= 30),
  constraint persons_gender_length check (gender is null or char_length(gender) <= 60),
  constraint persons_biography_length check (biography is null or char_length(biography) <= 10000),
  constraint persons_birth_place_length check (birth_place is null or char_length(birth_place) <= 200),
  constraint persons_death_place_length check (death_place is null or char_length(death_place) <= 200),
  constraint persons_birth_date_valid check (public.is_valid_partial_date(birth_date, birth_date_precision)),
  constraint persons_death_date_valid check (public.is_valid_partial_date(death_date, death_date_precision)),
  constraint persons_version_positive check (version > 0)
);

create index persons_family_idx on public.persons (family_id);
create index persons_family_archived_idx on public.persons (family_id, archived_at);
create index persons_display_name_idx on public.persons (family_id, display_name);

create or replace function public.prepare_person_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if v_actor is not null then
      new.created_by := v_actor;
      new.updated_by := v_actor;
    elsif auth.role() = 'service_role' then
      if new.created_by is null then
        raise exception 'created_by_required';
      end if;
      new.updated_by := new.created_by;
    else
      raise exception 'not_authenticated';
    end if;
    new.version := 1;
    new.updated_at := now();
    return new;
  end if;

  if new.family_id <> old.family_id
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at then
    raise exception 'person_identity_immutable';
  end if;

  if new.is_claimed <> old.is_claimed
     and coalesce(current_setting('app.person_link_sync', true), '') <> 'on' then
    raise exception 'claim_flag_managed';
  end if;

  if old.archived_at is not null and new.archived_at is null
     and not public.can_manage_family(old.family_id) then
    raise exception 'restore_requires_manager';
  end if;

  if v_actor is not null then
    new.updated_by := v_actor;
  elsif auth.role() = 'service_role' then
    if new.updated_by is null then
      raise exception 'updated_by_required';
    end if;
  else
    raise exception 'not_authenticated';
  end if;

  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger persons_prepare_write
before insert or update on public.persons
for each row execute function public.prepare_person_write();

create trigger audit_persons
after insert or update or delete on public.persons
for each row execute function public.audit_trigger();

create table public.person_names (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  name text not null,
  name_type public.name_type not null default 'alternate',
  created_at timestamptz not null default now(),
  constraint person_names_name_length check (char_length(trim(name)) between 1 and 200),
  unique (person_id, name, name_type)
);

create index person_names_person_idx on public.person_names (person_id);
create index person_names_family_idx on public.person_names (family_id);

create or replace function public.prepare_person_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.person_id <> old.person_id or new.family_id <> old.family_id then
      raise exception 'person_name_identity_immutable';
    end if;
  end if;

  select p.family_id into v_family_id
  from public.persons p
  where p.id = new.person_id and p.archived_at is null;

  if v_family_id is null then
    raise exception 'person_not_found';
  end if;

  new.family_id := v_family_id;
  return new;
end;
$$;

create trigger person_names_prepare_write
before insert or update on public.person_names
for each row execute function public.prepare_person_name();

create trigger audit_person_names
after insert or update or delete on public.person_names
for each row execute function public.audit_trigger();

create table public.parent_child_relationships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  parent_id uuid not null references public.persons (id) on delete restrict,
  child_id uuid not null references public.persons (id) on delete restrict,
  parentage_type public.parentage_type not null default 'biological',
  start_date text,
  start_date_precision public.date_precision not null default 'unknown',
  end_date text,
  end_date_precision public.date_precision not null default 'unknown',
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parentage_not_self check (parent_id <> child_id),
  constraint parentage_start_date_valid check (public.is_valid_partial_date(start_date, start_date_precision)),
  constraint parentage_end_date_valid check (public.is_valid_partial_date(end_date, end_date_precision)),
  constraint parentage_date_range check (start_date is null or end_date is null or end_date >= start_date),
  constraint parentage_notes_length check (notes is null or char_length(notes) <= 2000)
);

create index parentage_family_idx on public.parent_child_relationships (family_id);
create index parentage_parent_idx on public.parent_child_relationships (parent_id);
create index parentage_child_idx on public.parent_child_relationships (child_id);
create unique index parentage_active_unique_idx
on public.parent_child_relationships (parent_id, child_id, parentage_type)
where end_date is null;

create or replace function public.prepare_parentage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_family uuid;
  v_parent_archived timestamptz;
  v_child_family uuid;
  v_child_archived timestamptz;
  v_family_archived timestamptz;
  v_cycle boolean := false;
begin
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception 'parentage_identity_immutable';
    end if;
  else
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif auth.role() <> 'service_role' or new.created_by is null then
      raise exception 'not_authenticated';
    end if;
  end if;

  if new.parent_id = new.child_id then
    raise exception 'self_parentage';
  end if;

  select p.family_id, p.archived_at into v_parent_family, v_parent_archived
  from public.persons p where p.id = new.parent_id;
  select p.family_id, p.archived_at into v_child_family, v_child_archived
  from public.persons p where p.id = new.child_id;

  if v_parent_family is null or v_child_family is null then
    raise exception 'person_not_found';
  end if;
  if v_parent_archived is not null or v_child_archived is not null then
    raise exception 'person_archived';
  end if;
  if v_parent_family <> v_child_family then
    raise exception 'cross_workspace_relationship';
  end if;

  select f.archived_at into v_family_archived
  from public.families f where f.id = v_parent_family;
  if v_family_archived is not null then
    raise exception 'workspace_archived';
  end if;

  new.family_id := v_parent_family;
  new.updated_at := now();

  if new.end_date is null then
    with recursive descendants(id) as (
      select pcr.child_id
      from public.parent_child_relationships pcr
      where pcr.parent_id = new.child_id
        and pcr.end_date is null
        and pcr.id <> new.id
      union
      select pcr.child_id
      from public.parent_child_relationships pcr
      join descendants d on pcr.parent_id = d.id
      where pcr.end_date is null
        and pcr.id <> new.id
    )
    select exists (select 1 from descendants where id = new.parent_id) into v_cycle;

    if v_cycle then
      raise exception 'ancestry_cycle';
    end if;
  end if;

  return new;
end;
$$;

create trigger parentage_prepare_write
before insert or update on public.parent_child_relationships
for each row execute function public.prepare_parentage();

create trigger audit_parentage
after insert or update or delete on public.parent_child_relationships
for each row execute function public.audit_trigger();

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  partnership_type public.partnership_type not null default 'other',
  status public.partnership_status not null default 'unknown',
  start_date text,
  start_date_precision public.date_precision not null default 'unknown',
  end_date text,
  end_date_precision public.date_precision not null default 'unknown',
  location text,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnerships_start_date_valid check (public.is_valid_partial_date(start_date, start_date_precision)),
  constraint partnerships_end_date_valid check (public.is_valid_partial_date(end_date, end_date_precision)),
  constraint partnerships_date_range check (start_date is null or end_date is null or end_date >= start_date),
  constraint partnerships_location_length check (location is null or char_length(location) <= 200),
  constraint partnerships_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint partnerships_version_positive check (version > 0)
);

create index partnerships_family_idx on public.partnerships (family_id);

create or replace function public.prepare_partnership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_archived timestamptz;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif auth.role() <> 'service_role' or new.created_by is null then
      raise exception 'not_authenticated';
    end if;
    new.version := 1;
  else
    if new.family_id <> old.family_id
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception 'partnership_identity_immutable';
    end if;
    new.version := old.version + 1;
  end if;

  select f.archived_at into v_family_archived
  from public.families f where f.id = new.family_id;
  if v_family_archived is not null then
    raise exception 'workspace_archived';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger partnerships_prepare_write
before insert or update on public.partnerships
for each row execute function public.prepare_partnership();

create trigger audit_partnerships
after insert or update or delete on public.partnerships
for each row execute function public.audit_trigger();

create table public.partnership_participants (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  partnership_id uuid not null references public.partnerships (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete restrict,
  participant_role text,
  created_at timestamptz not null default now(),
  unique (partnership_id, person_id),
  constraint partnership_participant_role_length check (participant_role is null or char_length(participant_role) <= 60)
);

create index partnership_participants_partnership_idx on public.partnership_participants (partnership_id);
create index partnership_participants_person_idx on public.partnership_participants (person_id);
create index partnership_participants_family_idx on public.partnership_participants (family_id);

create or replace function public.prepare_partnership_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partnership_family uuid;
  v_partnership_archived timestamptz;
  v_person_family uuid;
  v_person_archived timestamptz;
begin
  select p.family_id into v_partnership_family
  from public.partnerships p where p.id = new.partnership_id;
  select p.family_id, p.archived_at into v_person_family, v_person_archived
  from public.persons p where p.id = new.person_id;

  if v_partnership_family is null or v_person_family is null then
    raise exception 'relationship_not_found';
  end if;
  if v_person_archived is not null then
    raise exception 'person_archived';
  end if;
  if v_partnership_family <> v_person_family then
    raise exception 'cross_workspace_relationship';
  end if;

  select f.archived_at into v_partnership_archived
  from public.families f where f.id = v_partnership_family;
  if v_partnership_archived is not null then
    raise exception 'workspace_archived';
  end if;

  new.family_id := v_partnership_family;
  return new;
end;
$$;

create trigger partnership_participants_prepare_write
before insert or update on public.partnership_participants
for each row execute function public.prepare_partnership_participant();

create or replace function public.ensure_partnership_has_two_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partnership_id uuid;
  v_family_id uuid;
  v_count integer;
begin
  if tg_op = 'DELETE' then
    v_partnership_id := old.partnership_id;
  else
    v_partnership_id := new.partnership_id;
  end if;

  select p.family_id into v_family_id
  from public.partnerships p where p.id = v_partnership_id;

  if v_family_id is null then
    return null;
  end if;

  select count(*)::integer into v_count
  from public.partnership_participants
  where partnership_id = v_partnership_id;

  if v_count < 2 then
    raise exception 'partnership_requires_two_participants';
  end if;

  return null;
end;
$$;

create constraint trigger partnership_participants_minimum
after insert or update or delete on public.partnership_participants
deferrable initially deferred
for each row execute function public.ensure_partnership_has_two_participants();

create trigger audit_partnership_participants
after insert or update or delete on public.partnership_participants
for each row execute function public.audit_trigger();

create table public.guardianships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  guardian_id uuid not null references public.persons (id) on delete restrict,
  ward_id uuid not null references public.persons (id) on delete restrict,
  guardianship_type public.guardianship_type not null default 'legal',
  start_date text,
  start_date_precision public.date_precision not null default 'unknown',
  end_date text,
  end_date_precision public.date_precision not null default 'unknown',
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardianship_not_self check (guardian_id <> ward_id),
  constraint guardianship_start_date_valid check (public.is_valid_partial_date(start_date, start_date_precision)),
  constraint guardianship_end_date_valid check (public.is_valid_partial_date(end_date, end_date_precision)),
  constraint guardianship_date_range check (start_date is null or end_date is null or end_date >= start_date),
  constraint guardianship_notes_length check (notes is null or char_length(notes) <= 2000)
);

create index guardianships_family_idx on public.guardianships (family_id);
create index guardianships_guardian_idx on public.guardianships (guardian_id);
create index guardianships_ward_idx on public.guardianships (ward_id);
create unique index guardianships_active_unique_idx
on public.guardianships (guardian_id, ward_id, guardianship_type)
where end_date is null;

create or replace function public.prepare_guardianship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guardian_family uuid;
  v_guardian_archived timestamptz;
  v_ward_family uuid;
  v_ward_archived timestamptz;
  v_family_archived timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception 'guardianship_identity_immutable';
    end if;
  else
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif auth.role() <> 'service_role' or new.created_by is null then
      raise exception 'not_authenticated';
    end if;
  end if;

  if new.guardian_id = new.ward_id then
    raise exception 'self_guardianship';
  end if;

  select p.family_id, p.archived_at into v_guardian_family, v_guardian_archived
  from public.persons p where p.id = new.guardian_id;
  select p.family_id, p.archived_at into v_ward_family, v_ward_archived
  from public.persons p where p.id = new.ward_id;

  if v_guardian_family is null or v_ward_family is null then
    raise exception 'person_not_found';
  end if;
  if v_guardian_archived is not null or v_ward_archived is not null then
    raise exception 'person_archived';
  end if;
  if v_guardian_family <> v_ward_family then
    raise exception 'cross_workspace_relationship';
  end if;

  select f.archived_at into v_family_archived
  from public.families f where f.id = v_guardian_family;
  if v_family_archived is not null then
    raise exception 'workspace_archived';
  end if;

  new.family_id := v_guardian_family;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guardianships_prepare_write
before insert or update on public.guardianships
for each row execute function public.prepare_guardianship();

create trigger audit_guardianships
after insert or update or delete on public.guardianships
for each row execute function public.audit_trigger();

create table public.person_account_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  approved_by uuid not null references public.profiles (id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (person_id),
  unique (family_id, user_id)
);

create index person_account_links_family_idx on public.person_account_links (family_id);
create index person_account_links_user_idx on public.person_account_links (user_id);

create table public.person_claims (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.claim_status not null default 'pending',
  message text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint person_claims_message_length check (message is null or char_length(message) <= 1000)
);

create index person_claims_family_idx on public.person_claims (family_id);
create index person_claims_person_idx on public.person_claims (person_id);
create index person_claims_user_idx on public.person_claims (user_id);
create unique index person_claims_pending_unique_idx
on public.person_claims (person_id, user_id)
where status = 'pending';

create or replace function public.prepare_person_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_life_status public.life_status;
  v_archived_at timestamptz;
begin
  select p.family_id, p.life_status, p.archived_at
  into v_family_id, v_life_status, v_archived_at
  from public.persons p where p.id = new.person_id;

  if v_family_id is null then
    raise exception 'person_not_found';
  end if;
  if v_archived_at is not null then
    raise exception 'person_archived';
  end if;
  if v_life_status <> 'living' then
    raise exception 'claim_requires_living_person';
  end if;
  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'claim_user_mismatch';
  end if;
  if not public.is_family_member(v_family_id) then
    raise exception 'not_authorized';
  end if;

  new.family_id := v_family_id;
  new.status := 'pending';
  return new;
end;
$$;

create trigger person_claims_prepare_write
before insert on public.person_claims
for each row execute function public.prepare_person_claim();

create trigger audit_person_claims
after insert or update or delete on public.person_claims
for each row execute function public.audit_trigger();

create or replace function public.prepare_person_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_life_status public.life_status;
  v_archived_at timestamptz;
begin
  select p.family_id, p.life_status, p.archived_at
  into v_family_id, v_life_status, v_archived_at
  from public.persons p where p.id = new.person_id;

  if v_family_id is null then
    raise exception 'person_not_found';
  end if;
  if v_archived_at is not null then
    raise exception 'person_archived';
  end if;
  if v_life_status <> 'living' then
    raise exception 'claim_requires_living_person';
  end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = v_family_id and fm.user_id = new.user_id
  ) then
    raise exception 'not_authorized';
  end if;
  if auth.uid() is not null then
    new.approved_by := auth.uid();
  end if;
  new.family_id := v_family_id;
  new.approved_at := now();
  return new;
end;
$$;

create trigger person_account_links_prepare_write
before insert on public.person_account_links
for each row execute function public.prepare_person_link();

create or replace function public.sync_person_claimed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.person_link_sync', 'on', true);
  if tg_op = 'INSERT' then
    update public.persons set is_claimed = true where id = new.person_id;
    perform set_config('app.person_link_sync', 'off', true);
    return new;
  end if;
  update public.persons
  set is_claimed = exists (
    select 1 from public.person_account_links
    where person_id = old.person_id
  )
  where id = old.person_id;
  perform set_config('app.person_link_sync', 'off', true);
  return old;
end;
$$;

create trigger person_account_links_sync_claimed
after insert or delete on public.person_account_links
for each row execute function public.sync_person_claimed();

create trigger audit_person_account_links
after insert or update or delete on public.person_account_links
for each row execute function public.audit_trigger();

-- Server-side search across display names and alternative names. This is
-- SECURITY INVOKER so the caller's RLS policies still apply.
create or replace function public.search_people(
  p_family_id uuid,
  p_query text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.persons
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.persons p
  where p.family_id = p_family_id
    and p.archived_at is null
    and (
      coalesce(trim(p_query), '') = ''
      or p.display_name ilike '%' || trim(p_query) || '%'
      or coalesce(p.given_name, '') ilike '%' || trim(p_query) || '%'
      or coalesce(p.surname, '') ilike '%' || trim(p_query) || '%'
      or exists (
        select 1 from public.person_names pn
        where pn.person_id = p.id
          and pn.name ilike '%' || trim(p_query) || '%'
      )
    )
  order by p.display_name asc, p.created_at asc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.search_people(uuid, text, integer, integer) from public, anon;
grant execute on function public.search_people(uuid, text, integer, integer) to authenticated;
