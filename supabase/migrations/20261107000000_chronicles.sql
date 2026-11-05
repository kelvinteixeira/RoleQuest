-- Role Quest — Chronicles Studio: episodes made from the campaign's best moments.
--
-- An episode keeps the chosen moments, the script written by AI (scenes with
-- narration, dialogue and image prompts) and the generated images (paths in
-- the private `chronicles` Storage bucket). GMs only, for now.

create table public.chronicle_episodes (
  id text primary key default gen_random_uuid()::text,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  title text not null default 'Episódio' check (char_length(title) between 1 and 120),
  moment_ids text[] not null default '{}',
  script jsonb,
  -- scene / character key -> Storage path
  images jsonb not null default '{}'::jsonb,
  created_by text default auth.uid()::text references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chronicle_episodes_campaign_idx on public.chronicle_episodes (campaign_id);
create trigger chronicle_episodes_touch before update on public.chronicle_episodes for each row execute function public.touch_updated_at();
alter table public.chronicle_episodes enable row level security;
create policy chronicle_episodes_read on public.chronicle_episodes for select to authenticated using (public.is_gm(campaign_id));
-- The author is whoever creates it.
create policy chronicle_episodes_insert on public.chronicle_episodes for insert to authenticated with check (public.is_gm(campaign_id) and created_by = public.me());
create policy chronicle_episodes_update on public.chronicle_episodes for update to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy chronicle_episodes_delete on public.chronicle_episodes for delete to authenticated using (public.is_gm(campaign_id));

-- ---------------------------------------------------------------------------
-- AI spend: anyone can make a campaign (and be its GM), so the AI routes take
-- a daily allowance per person, counted here by the server before each call.
-- ---------------------------------------------------------------------------

create table public.chronicle_usage (
  user_id text not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('script', 'image')),
  count integer not null default 0,
  primary key (user_id, day, kind)
);
alter table public.chronicle_usage enable row level security;
create policy chronicle_usage_own on public.chronicle_usage for select to authenticated using (user_id = public.me());

-- Counts one AI call for the caller, if they are a GM of the campaign and still
-- have allowance today (scripts: 20, images: 120). False when the day's allowance is used up.
create function public.spend_chronicle_quota(cid text, what text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  allowance integer := case what when 'script' then 20 when 'image' then 120 else 0 end;
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
revoke execute on function public.spend_chronicle_quota(text, text) from public, anon;
grant execute on function public.spend_chronicle_quota(text, text) to authenticated;

-- Images: private bucket, one folder per campaign (`<campaign_id>/<episode_id>/<key>.png`).
do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  -- Images only, up to 10 MB each.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('chronicles', 'chronicles', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute $p$create policy chronicles_gm_read on storage.objects for select to authenticated
    using (bucket_id = 'chronicles' and public.is_gm((storage.foldername(name))[1]))$p$;
  execute $p$create policy chronicles_gm_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'chronicles' and public.is_gm((storage.foldername(name))[1]))$p$;
  execute $p$create policy chronicles_gm_update on storage.objects for update to authenticated
    using (bucket_id = 'chronicles' and public.is_gm((storage.foldername(name))[1]))$p$;
  execute $p$create policy chronicles_gm_delete on storage.objects for delete to authenticated
    using (bucket_id = 'chronicles' and public.is_gm((storage.foldername(name))[1]))$p$;
end $$;
