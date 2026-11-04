-- Private media foundation. Media UI arrives in Release 2; the bucket and
-- policies are created now so uploads can never be public by accident.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media',
  'family-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {family_id}/{media_id}/{file_name}
create policy family_media_select_member on storage.objects
for select to authenticated
using (
  bucket_id = 'family-media'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.is_family_member(((storage.foldername(name))[1])::uuid)
);

create policy family_media_insert_editor on storage.objects
for insert to authenticated
with check (
  bucket_id = 'family-media'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_edit_family(((storage.foldername(name))[1])::uuid)
);

create policy family_media_update_editor on storage.objects
for update to authenticated
using (
  bucket_id = 'family-media'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_edit_family(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'family-media'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_edit_family(((storage.foldername(name))[1])::uuid)
);

create policy family_media_delete_manager on storage.objects
for delete to authenticated
using (
  bucket_id = 'family-media'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_manage_family(((storage.foldername(name))[1])::uuid)
);
