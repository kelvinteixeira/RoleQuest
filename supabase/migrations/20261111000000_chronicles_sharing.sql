-- Role Quest — Chronicles: narration and episodes shared with the players.
--
-- * `voices`: recorded narration per scene (Storage path, the caption it reads
--   and its length), next to the images in the private `chronicles` bucket.
-- * `published_at`: when the GM shared the episode. The campaign's players can
--   then watch it (video and comic), read-only, with its images and narration;
--   unpublished episodes stay with the GMs.
-- * A daily allowance for narration clips, like scripts and images.

alter table public.chronicle_episodes
  add column voices jsonb not null default '{}'::jsonb,
  add column published_at timestamptz;

drop policy chronicle_episodes_read on public.chronicle_episodes;
create policy chronicle_episodes_read on public.chronicle_episodes for select to authenticated
  using (public.is_gm(campaign_id) or (published_at is not null and public.is_member(campaign_id)));
-- Writing stays with the GMs (insert / update / delete policies unchanged): players can't share or unshare.

-- A file of the bucket (`<campaign>/<episode>/<key>.<ext>`) is readable by the
-- campaign's GMs, and by its members when a shared episode of that campaign uses it.
create function public.can_see_chronicle_file(path text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_gm(split_part(path, '/', 1))
    or (public.is_member(split_part(path, '/', 1)) and exists (
      select 1 from chronicle_episodes e
      where e.campaign_id = split_part(path, '/', 1) and e.published_at is not null
        and (exists (select 1 from jsonb_each_text(e.images) i where i.value = path)
          or exists (select 1 from jsonb_each(e.voices) v where v.value ->> 'ref' = path))))
$$;
revoke execute on function public.can_see_chronicle_file(text) from public, anon;
grant execute on function public.can_see_chronicle_file(text) to authenticated;

-- Narration clips count against their own daily allowance (200 a day).
alter table public.chronicle_usage drop constraint chronicle_usage_kind_check;
alter table public.chronicle_usage add constraint chronicle_usage_kind_check check (kind in ('script', 'image', 'voice'));

create or replace function public.spend_chronicle_quota(cid text, what text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  allowance integer := case what when 'script' then 20 when 'image' then 120 when 'voice' then 200 else 0 end;
  used integer;
begin
  if not public.is_gm(cid) then raise exception 'Só os mestres da campanha criam episódios.' using errcode = '42501'; end if;
  if allowance = 0 then raise exception 'Uso desconhecido.' using errcode = '22023'; end if;
  insert into chronicle_usage (user_id, kind, count) values (auth.uid()::text, what, 1)
    on conflict (user_id, day, kind) do update set count = chronicle_usage.count + 1
    returning count into used;
  if used > allowance then
    update chronicle_usage set count = count - 1 where user_id = auth.uid()::text and day = current_date and kind = what;
    return false;
  end if;
  return true;
end $$;

-- Storage: narration (WAV) joins the images; members read what shared episodes use.
do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'audio/wav'] where id = 'chronicles';
  drop policy if exists chronicles_gm_read on storage.objects;
  execute $p$create policy chronicles_read on storage.objects for select to authenticated
    using (bucket_id = 'chronicles' and public.can_see_chronicle_file(name))$p$;
end $$;
