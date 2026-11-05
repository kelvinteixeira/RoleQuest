-- Role Quest — the table in real time.
--
-- One GM client "hosts" the room: it holds the full state, applies every
-- change and writes, for each other member, the view they may see (players:
-- fog-filtered, no hidden traps, no GM notes or secret rolls). Players never
-- receive the full state: they read their own view row and send intents
-- (move, chat, roll, attack…), which the host validates and applies.
-- Clients follow rows through Supabase Realtime (postgres_changes, RLS applies).

-- ---------------------------------------------------------------------------
-- The room's full state (GMs only) and who hosts it
-- ---------------------------------------------------------------------------

create table public.room_states (
  campaign_id text primary key references public.campaigns (id) on delete cascade,
  state jsonb,
  revision bigint not null default 0,
  host_user text references public.profiles (id) on delete set null,
  host_client text,
  host_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger room_states_touch before update on public.room_states for each row execute function public.touch_updated_at();
alter table public.room_states enable row level security;
create policy room_states_gm on public.room_states for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

-- A GM client takes (or keeps) the host role: free, its own, stale for 90 s, or taken over.
-- (90 s: browsers slow down timers of background tabs to about once a minute.)
create function public.claim_room_host(cid text, client text, takeover boolean default false)
returns table (holder_user text, holder_client text, hosting boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_gm(cid) then raise exception 'Só os mestres conduzem a mesa.' using errcode = '42501'; end if;
  insert into room_states (campaign_id) values (cid) on conflict (campaign_id) do nothing;
  update room_states r set host_user = auth.uid()::text, host_client = client, host_seen_at = now()
    where r.campaign_id = cid
      and (takeover or r.host_client is null or r.host_client = client or r.host_seen_at < now() - interval '90 seconds');
  return query select r.host_user, r.host_client, r.host_client = client from room_states r where r.campaign_id = cid;
end $$;

create function public.release_room_host(cid text, client text) returns void
language sql security definer set search_path = public as $$
  update room_states set host_client = null, host_seen_at = null where campaign_id = cid and host_client = client and public.is_gm(cid)
$$;

-- ---------------------------------------------------------------------------
-- What each member sees, written by the host
-- ---------------------------------------------------------------------------

create table public.room_views (
  campaign_id text not null references public.campaigns (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  view jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
alter table public.room_views enable row level security;
create policy room_views_own on public.room_views for select to authenticated using ((user_id = public.me() and public.is_member(campaign_id)) or public.is_gm(campaign_id));
create policy room_views_gm_insert on public.room_views for insert to authenticated with check (public.is_gm(campaign_id));
create policy room_views_gm_update on public.room_views for update to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy room_views_gm_delete on public.room_views for delete to authenticated using (public.is_gm(campaign_id));

-- The players' map (no GM notes, no hidden traps): shared, changes rarely.
create table public.room_view_maps (
  campaign_id text primary key references public.campaigns (id) on delete cascade,
  map jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.room_view_maps enable row level security;
create policy room_view_maps_read on public.room_view_maps for select to authenticated using (public.is_member(campaign_id));
create policy room_view_maps_gm on public.room_view_maps for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

-- Only the client that holds the lease publishes: a host that lost it (taken
-- over, or asleep) can't overwrite the new host's views. Returns false then.
create function public.publish_room(cid text, client text, views jsonb, map jsonb default null, map_revision bigint default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_gm(cid) then raise exception 'Só os mestres conduzem a mesa.' using errcode = '42501'; end if;
  if not exists (select 1 from room_states where campaign_id = cid and host_client = client) then return false; end if;
  if map is not null then
    insert into room_view_maps (campaign_id, map, revision) values (cid, map, coalesce(map_revision, 0))
      on conflict (campaign_id) do update set map = excluded.map, revision = excluded.revision, updated_at = now();
  end if;
  insert into room_views (campaign_id, user_id, view, revision)
    select cid, v.user_id, v.view, coalesce(v.revision, 0)
    from jsonb_to_recordset(coalesce(views, '[]'::jsonb)) as v(user_id text, view jsonb, revision bigint)
    where exists (select 1 from campaign_members m where m.campaign_id = cid and m.user_id = v.user_id)
    on conflict (campaign_id, user_id) do update set view = excluded.view, revision = excluded.revision, updated_at = now();
  return true;
end $$;

create function public.save_room_state(cid text, client text, room jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_gm(cid) then raise exception 'Só os mestres conduzem a mesa.' using errcode = '42501'; end if;
  update room_states set state = room, revision = revision + 1 where campaign_id = cid and host_client = client;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- What members ask the host to do
-- ---------------------------------------------------------------------------

create table public.room_intents (
  id text primary key default gen_random_uuid()::text,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  user_id text not null default auth.uid()::text references public.profiles (id) on delete cascade,
  intent jsonb not null check (octet_length(intent::text) <= 20000),
  created_at timestamptz not null default now()
);
create index room_intents_campaign_idx on public.room_intents (campaign_id, created_at);
alter table public.room_intents enable row level security;
-- Members speak only for themselves; the host (a GM) reads and clears them.
create policy room_intents_insert on public.room_intents for insert to authenticated with check (user_id = public.me() and public.is_member(campaign_id));
create policy room_intents_read on public.room_intents for select to authenticated using (public.is_gm(campaign_id) or user_id = public.me());
create policy room_intents_gm_delete on public.room_intents for delete to authenticated using (public.is_gm(campaign_id));

-- Host: intents not handled yet, at most a minute old (older ones are dropped).
create function public.pending_room_intents(cid text) returns setof public.room_intents
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_gm(cid) then raise exception 'Só os mestres conduzem a mesa.' using errcode = '42501'; end if;
  delete from room_intents where campaign_id = cid and created_at < now() - interval '60 seconds';
  return query select * from room_intents where campaign_id = cid order by created_at;
end $$;

-- ---------------------------------------------------------------------------
-- Who is at the table (heartbeat every few seconds)
-- ---------------------------------------------------------------------------

create table public.room_presence (
  campaign_id text not null references public.campaigns (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  hosting boolean not null default false,
  seen_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
alter table public.room_presence enable row level security;
create policy room_presence_read on public.room_presence for select to authenticated using (public.is_member(campaign_id));
-- Only a GM may say they host the table.
create policy room_presence_insert on public.room_presence for insert to authenticated
  with check (user_id = public.me() and public.is_member(campaign_id) and (not hosting or public.is_gm(campaign_id)));
create policy room_presence_update on public.room_presence for update to authenticated
  using (user_id = public.me())
  with check (user_id = public.me() and public.is_member(campaign_id) and (not hosting or public.is_gm(campaign_id)));
create policy room_presence_delete on public.room_presence for delete to authenticated using (user_id = public.me() or public.is_gm(campaign_id));

-- The server's clock, not each browser's, says when someone was last seen.
create function public.stamp_presence() returns trigger language plpgsql set search_path = public as $$
begin
  new.seen_at := now();
  return new;
end $$;
create trigger room_presence_stamp before insert or update on public.room_presence for each row execute function public.stamp_presence();

-- Someone who leaves the campaign leaves the table.
create function public.drop_presence_of_member() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from room_presence where campaign_id = old.campaign_id and user_id = old.user_id;
  delete from room_views where campaign_id = old.campaign_id and user_id = old.user_id;
  return old;
end $$;
create trigger campaign_members_leave_table after delete on public.campaign_members for each row execute function public.drop_presence_of_member();

revoke execute on function public.claim_room_host(text, text, boolean), public.release_room_host(text, text), public.publish_room(text, text, jsonb, jsonb, bigint),
  public.save_room_state(text, text, jsonb), public.pending_room_intents(text) from public, anon;
grant execute on function public.claim_room_host(text, text, boolean), public.release_room_host(text, text), public.publish_room(text, text, jsonb, jsonb, bigint),
  public.save_room_state(text, text, jsonb), public.pending_room_intents(text) to authenticated;

-- Realtime: clients follow these tables (each subscriber only gets rows its RLS allows).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.room_views, public.room_view_maps, public.room_intents, public.room_presence;
  end if;
end $$;
