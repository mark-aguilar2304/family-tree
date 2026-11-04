-- Core identity, workspace, membership, audit, and rate-limit foundations.
-- All workspace-scoped tables carry family_id so RLS never depends on a join
-- that the browser can influence.

create type public.family_role as enum ('owner', 'admin', 'contributor', 'viewer');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.parentage_type as enum ('biological', 'adoptive', 'legal', 'foster', 'step');
create type public.partnership_type as enum ('marriage', 'domestic_partnership', 'other');
create type public.partnership_status as enum ('current', 'ended', 'divorced', 'separated', 'widowed', 'unknown');
create type public.guardianship_type as enum ('legal', 'informal', 'foster', 'other');
create type public.life_status as enum ('living', 'deceased', 'unknown');
create type public.date_precision as enum ('exact', 'month', 'year', 'approximate', 'unknown');
create type public.name_type as enum ('maiden', 'nickname', 'alias', 'previous', 'alternate');
create type public.claim_status as enum ('pending', 'approved', 'rejected', 'withdrawn');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 120)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Profiles are created for every Supabase user, including invited relatives.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_image_path text,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint families_name_length check (char_length(trim(name)) between 1 and 120),
  constraint families_description_length check (description is null or char_length(description) <= 2000)
);

create index families_owner_idx on public.families (owner_id);
create trigger families_set_updated_at
before update on public.families
for each row execute function public.set_updated_at();

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.family_role not null default 'contributor',
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create index family_members_family_idx on public.family_members (family_id);
create index family_members_user_idx on public.family_members (user_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_family_created_idx on public.audit_logs (family_id, created_at desc);

-- Generic audit trigger. Invitation token hashes must never be logged.
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_action := 'delete';
    v_old := to_jsonb(old) - 'token_hash';
    v_new := null;
    v_entity_id := (to_jsonb(old) ->> 'id')::uuid;
    if tg_table_name = 'families' then
      v_family_id := v_entity_id;
    else
      v_family_id := (to_jsonb(old) ->> 'family_id')::uuid;
    end if;
  else
    v_action := case when tg_op = 'UPDATE' then 'update' else 'insert' end;
    v_old := case when tg_op = 'UPDATE' then to_jsonb(old) - 'token_hash' else null end;
    v_new := to_jsonb(new) - 'token_hash';
    v_entity_id := (to_jsonb(new) ->> 'id')::uuid;
    if tg_table_name = 'families' then
      v_family_id := v_entity_id;
    else
      v_family_id := (to_jsonb(new) ->> 'family_id')::uuid;
    end if;
  end if;

  if v_family_id is not null then
    insert into public.audit_logs (
      family_id, actor_user_id, entity_type, entity_id, action, old_values, new_values
    ) values (
      v_family_id, auth.uid(), tg_table_name, v_entity_id, v_action, v_old, v_new
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_families
after insert or update or delete on public.families
for each row execute function public.audit_trigger();

create trigger audit_family_members
after insert or update or delete on public.family_members
for each row execute function public.audit_trigger();

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_key_created_idx on public.rate_limit_events (key, created_at desc);

-- Per-user, durable rate limiting for sensitive server actions.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_key text;
  v_count integer;
begin
  if v_actor is null or p_key is null or char_length(p_key) > 160
     or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  v_key := v_actor::text || ':' || p_key;

  delete from public.rate_limit_events
  where key = v_key
    and created_at < now() - make_interval(secs => p_window_seconds * 2);

  insert into public.rate_limit_events (key) values (v_key);

  select count(*)::integer into v_count
  from public.rate_limit_events
  where key = v_key
    and created_at >= now() - make_interval(secs => p_window_seconds);

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

-- Workspace authorization helpers. SECURITY DEFINER avoids recursive RLS
-- checks on family_members; every function is scoped to the caller.
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = auth.uid()
  );
$$;

create or replace function public.family_role(p_family_id uuid)
returns public.family_role
language sql
stable
security definer
set search_path = ''
as $$
  select fm.role
  from public.family_members fm
  where fm.family_id = p_family_id
    and fm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_family_owner(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.families f
    where f.id = p_family_id and f.owner_id = auth.uid()
  );
$$;

create or replace function public.can_edit_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.families f
    where f.id = p_family_id
      and f.archived_at is null
      and public.family_role(p_family_id) in (
        'owner'::public.family_role,
        'admin'::public.family_role,
        'contributor'::public.family_role
      )
  );
$$;

create or replace function public.can_manage_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.families f
    where f.id = p_family_id
      and f.archived_at is null
      and public.family_role(p_family_id) in (
        'owner'::public.family_role,
        'admin'::public.family_role
      )
  );
$$;

create or replace function public.can_administer_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.family_role(p_family_id) in (
    'owner'::public.family_role,
    'admin'::public.family_role
  );
$$;

create or replace function public.shares_family_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members mine
    join public.family_members theirs on theirs.family_id = mine.family_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function public.is_family_member(uuid) from public, anon;
revoke all on function public.family_role(uuid) from public, anon;
revoke all on function public.is_family_owner(uuid) from public, anon;
revoke all on function public.can_edit_family(uuid) from public, anon;
revoke all on function public.can_manage_family(uuid) from public, anon;
revoke all on function public.can_administer_family(uuid) from public, anon;
revoke all on function public.shares_family_with(uuid) from public, anon;

grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.family_role(uuid) to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;
grant execute on function public.can_edit_family(uuid) to authenticated;
grant execute on function public.can_manage_family(uuid) to authenticated;
grant execute on function public.can_administer_family(uuid) to authenticated;
grant execute on function public.shares_family_with(uuid) to authenticated;

-- A workspace must always have exactly one owner membership, and that
-- membership must match families.owner_id. Checks are deferred so multi-table
-- RPCs can complete in one transaction.
create or replace function public.ensure_family_owner_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_owner_id uuid;
  v_owner_count integer;
  v_matching_count integer;
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'families' then
      v_family_id := old.id;
    else
      v_family_id := old.family_id;
    end if;
  else
    if tg_table_name = 'families' then
      v_family_id := new.id;
    else
      v_family_id := new.family_id;
    end if;
  end if;

  select owner_id into v_owner_id from public.families where id = v_family_id;
  if v_owner_id is null then
    return null;
  end if;

  select count(*)::integer into v_owner_count
  from public.family_members
  where family_id = v_family_id and role = 'owner';

  select count(*)::integer into v_matching_count
  from public.family_members
  where family_id = v_family_id and role = 'owner' and user_id = v_owner_id;

  if v_owner_count <> 1 or v_matching_count <> 1 then
    raise exception 'family_owner_consistency';
  end if;

  return null;
end;
$$;

create constraint trigger families_owner_consistency
after insert or update on public.families
deferrable initially deferred
for each row execute function public.ensure_family_owner_consistency();

create constraint trigger family_members_owner_consistency
after insert or update or delete on public.family_members
deferrable initially deferred
for each row execute function public.ensure_family_owner_consistency();
