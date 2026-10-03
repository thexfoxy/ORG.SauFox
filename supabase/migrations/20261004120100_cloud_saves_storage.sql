-- The private bucket for cloud saves: one ZIP per player and game, at
-- <user id>/<work id>/save.zip, up to 50 MB. A player can read and write
-- only their own files, and only for games they own. Nobody else (not even
-- other signed-in players) can list or read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('saves', 'saves', false, 52428800, array['application/zip'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = array['application/zip'];

create policy "Cloud saves: read your own" on storage.objects for select to authenticated
  using (bucket_id = 'saves'
    and name ~ ('^' || (select auth.uid())::text || '/[a-z0-9-]{1,80}/save\.zip$')
    and public.owns_work(split_part(name, '/', 2)));
create policy "Cloud saves: add your own" on storage.objects for insert to authenticated
  with check (bucket_id = 'saves'
    and name ~ ('^' || (select auth.uid())::text || '/[a-z0-9-]{1,80}/save\.zip$')
    and public.owns_work(split_part(name, '/', 2)));
create policy "Cloud saves: replace your own" on storage.objects for update to authenticated
  using (bucket_id = 'saves'
    and name ~ ('^' || (select auth.uid())::text || '/[a-z0-9-]{1,80}/save\.zip$')
    and public.owns_work(split_part(name, '/', 2)))
  with check (bucket_id = 'saves'
    and name ~ ('^' || (select auth.uid())::text || '/[a-z0-9-]{1,80}/save\.zip$')
    and public.owns_work(split_part(name, '/', 2)));

select 'done' as result;
