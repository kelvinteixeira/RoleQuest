-- Role Quest — migration not yet applied (20261108000000_map_images_and_audio.sql).
-- Paste into Supabase → SQL Editor → Run. Atomic: if anything fails, nothing is applied.
-- Generated from supabase/migrations/*.sql — edit those, not this file.

begin;

-- ===== 20261108000000_map_images_and_audio.sql =====

-- Role Quest — shared map pictures and the table's audio library.
--
-- Map pictures move from each GM's browser to Storage (`map-images`), so the
-- players see the imported map too. The audio centre's uploaded tracks live
-- in `table-audio`, listed in campaign_audio_tracks. Both buckets are private
-- with one folder per campaign, written by GMs. Members hear every track, but
-- see a map picture only once it is on the players' map: GMs may prepare maps
-- the players must not peek at.

create table public.campaign_audio_tracks (
  id text primary key default gen_random_uuid()::text,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  path text not null,
  mime_type text not null,
  created_by text default auth.uid()::text references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index campaign_audio_tracks_campaign_idx on public.campaign_audio_tracks (campaign_id);
alter table public.campaign_audio_tracks enable row level security;
create policy audio_tracks_read on public.campaign_audio_tracks for select to authenticated using (public.is_member(campaign_id));
-- The file must sit in the campaign's folder.
create policy audio_tracks_insert on public.campaign_audio_tracks for insert to authenticated
  with check (public.is_gm(campaign_id) and created_by = public.me() and split_part(path, '/', 1) = campaign_id);
create policy audio_tracks_delete on public.campaign_audio_tracks for delete to authenticated using (public.is_gm(campaign_id));

-- True when the picture at `path` may be shown to the caller.
create function public.can_see_map_image(path text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_gm(split_part(path, '/', 1))
    or (public.is_member(split_part(path, '/', 1)) and exists (
      select 1 from room_view_maps v where v.campaign_id = split_part(path, '/', 1) and v.map -> 'background' ->> 'imageId' = path))
$$;

do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('map-images', 'map-images', false, 15728640, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  -- Same list as TRACK_TYPES in src/features/audio-engine/catalog.ts.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('table-audio', 'table-audio', false, 26214400, array['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/flac'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  -- GMs add, replace and remove; members read tracks and the map on the table.
  execute $p$create policy campaign_audio_read on storage.objects for select to authenticated
    using (bucket_id = 'table-audio' and public.is_member((storage.foldername(name))[1]))$p$;
  execute $p$create policy campaign_map_image_read on storage.objects for select to authenticated
    using (bucket_id = 'map-images' and public.can_see_map_image(name))$p$;
  execute $p$create policy campaign_media_insert on storage.objects for insert to authenticated
    with check (bucket_id in ('map-images', 'table-audio') and public.is_gm((storage.foldername(name))[1]))$p$;
  execute $p$create policy campaign_media_update on storage.objects for update to authenticated
    using (bucket_id in ('map-images', 'table-audio') and public.is_gm((storage.foldername(name))[1]))$p$;
  execute $p$create policy campaign_media_delete on storage.objects for delete to authenticated
    using (bucket_id in ('map-images', 'table-audio') and public.is_gm((storage.foldername(name))[1]))$p$;
end $$;


commit;
