create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null,
  role public.family_role not null,
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles (id) on delete restrict,
  accepted_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_lowercase check (email = lower(email)),
  constraint invitations_role_not_owner check (role <> 'owner'),
  constraint invitations_status_timestamps check (
    (status = 'accepted' and accepted_at is not null)
    or (status = 'revoked' and revoked_at is not null)
    or status in ('pending', 'expired')
  )
);

create unique index invitations_pending_family_email_idx
on public.invitations (family_id, email)
where status = 'pending';

create index invitations_family_idx on public.invitations (family_id);
create index invitations_email_idx on public.invitations (email);

create trigger invitations_set_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

create trigger audit_invitations
after insert or update or delete on public.invitations
for each row execute function public.audit_trigger();

-- The raw token is generated in the server action. Only its SHA-256 hash is
-- stored here; the RPC never returns it.
create or replace function public.create_invitation(
  p_family_id uuid,
  p_email text,
  p_role public.family_role,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.family_role;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_existing_user uuid;
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;
  if not public.can_manage_family(p_family_id) then
    raise exception 'not_authorized';
  end if;
  if p_role = 'owner' then
    raise exception 'owner_role_requires_transfer';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'invalid_expiry';
  end if;

  v_actor_role := public.family_role(p_family_id);
  if v_actor_role = 'admin' and p_role = 'admin' then
    raise exception 'admin_cannot_invite_admin';
  end if;

  select u.id into v_existing_user
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_existing_user is not null and exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = v_existing_user
  ) then
    raise exception 'already_member';
  end if;

  insert into public.invitations (
    family_id, email, role, token_hash, invited_by, expires_at
  ) values (
    p_family_id, v_email, p_role, p_token_hash, v_actor, p_expires_at
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'invitation_exists';
end;
$$;

create or replace function public.rotate_invitation(
  p_invitation_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
begin
  select * into v_invitation
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;
  if not public.can_manage_family(v_invitation.family_id) then
    raise exception 'not_authorized';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'invalid_expiry';
  end if;

  update public.invitations
  set token_hash = p_token_hash,
      expires_at = p_expires_at
  where id = p_invitation_id;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
begin
  select * into v_invitation
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;
  if not public.can_manage_family(v_invitation.family_id) then
    raise exception 'not_authorized';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  update public.invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_hash text;
  v_invitation public.invitations%rowtype;
  v_family_archived timestamptz;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 200 then
    raise exception 'invalid_invitation';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_actor;
  if v_email is null then
    raise exception 'not_authenticated';
  end if;

  v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  select * into v_invitation
  from public.invitations
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'invalid_invitation';
  end if;

  if v_invitation.status = 'accepted' then
    if v_invitation.accepted_by = v_actor and exists (
      select 1 from public.family_members fm
      where fm.family_id = v_invitation.family_id and fm.user_id = v_actor
    ) then
      return v_invitation.family_id;
    end if;
    raise exception 'invitation_used';
  end if;

  if v_invitation.status = 'revoked' then
    raise exception 'invitation_revoked';
  end if;

  if v_invitation.status = 'expired' or v_invitation.expires_at <= now() then
    update public.invitations
    set status = 'expired'
    where id = v_invitation.id and status = 'pending';
    raise exception 'invitation_expired';
  end if;

  if v_invitation.email <> v_email then
    raise exception 'invitation_email_mismatch';
  end if;

  select f.archived_at into v_family_archived
  from public.families f
  where f.id = v_invitation.family_id;

  if v_family_archived is not null then
    raise exception 'workspace_archived';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_invitation.family_id, v_actor, v_invitation.role)
  on conflict (family_id, user_id) do nothing;

  update public.invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = v_actor
  where id = v_invitation.id;

  return v_invitation.family_id;
end;
$$;

create or replace function public.list_my_invitations()
returns table (
  id uuid,
  family_id uuid,
  family_name text,
  role public.family_role,
  status public.invitation_status,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.family_id,
    f.name,
    i.role,
    case
      when i.status = 'pending' and i.expires_at <= now()
        then 'expired'::public.invitation_status
      else i.status
    end as status,
    i.expires_at,
    i.created_at
  from public.invitations i
  join public.families f on f.id = i.family_id
  where i.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and i.status in ('pending', 'expired')
  order by i.created_at desc;
$$;

revoke all on function public.create_invitation(uuid, text, public.family_role, text, timestamptz) from public, anon;
revoke all on function public.rotate_invitation(uuid, text, timestamptz) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.list_my_invitations() from public, anon;

grant execute on function public.create_invitation(uuid, text, public.family_role, text, timestamptz) to authenticated;
grant execute on function public.rotate_invitation(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.list_my_invitations() to authenticated;
