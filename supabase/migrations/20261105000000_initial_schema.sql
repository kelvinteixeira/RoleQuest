-- Role Quest — initial schema.
--
-- Mirrors the app's repository contracts (src/repositories/contracts.ts).
-- Access rules are Row Level Security policies that mirror src/lib/permissions.ts:
-- the database is the source of truth; the services' checks are a first line.
--
-- Ids are text so they match the app's prefixed ids; new rows get a UUID.
-- Nested domain objects (sheets, map documents, system templates…) are jsonb.


-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id text primary key,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  username text not null unique check (username ~ '^[a-z0-9._-]{2,40}$'),
  avatar_url text,
  avatar_color text not null default 'oklch(0.62 0.16 300)',
  bio text not null default '' check (char_length(bio) <= 500),
  play_style text not null default 'both' check (play_style in ('game_master', 'player', 'both')),
  favorite_system_ids text[] not null default '{}',
  timezone text not null default 'America/Sao_Paulo',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Campaigns and their people
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 3 and 60),
  tagline text not null default '' check (char_length(tagline) <= 160),
  system_id text not null,
  visual_style_id text not null,
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'completed')),
  owner_id text not null references public.profiles (id) on delete cascade,
  world jsonb not null default '{}'::jsonb,
  game_master jsonb not null default '{}'::jsonb,
  player_policy jsonb not null default '{}'::jsonb,
  last_played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id text not null references public.campaigns (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('game_master', 'player')),
  character_id text,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index campaign_members_user_idx on public.campaign_members (user_id);

create table public.game_sessions (
  id text primary key default gen_random_uuid()::text,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  number integer not null check (number >= 1),
  title text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 180,
  summary text not null default '',
  highlights text[] not null default '{}',
  attendee_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_sessions_campaign_idx on public.game_sessions (campaign_id);

create table public.campaign_invites (
  id text primary key default gen_random_uuid()::text,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  campaign_name text not null,
  system_id text not null,
  invited_by_id text not null references public.profiles (id) on delete cascade,
  invited_by_name text not null,
  email text not null check (email = lower(email)),
  message text not null default '' check (char_length(message) <= 400),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaign_invites_campaign_idx on public.campaign_invites (campaign_id);
create index campaign_invites_email_idx on public.campaign_invites (email);

-- ---------------------------------------------------------------------------
-- Characters, systems, library
-- ---------------------------------------------------------------------------

create table public.characters (
  id text primary key default gen_random_uuid()::text,
  owner_id text not null references public.profiles (id) on delete cascade,
  campaign_id text references public.campaigns (id) on delete set null,
  system_id text not null,
  name text not null check (char_length(name) between 1 and 50),
  concept text not null default '',
  level integer,
  portrait_color text not null,
  avatar_url text,
  resources jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  sheet jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index characters_owner_idx on public.characters (owner_id);
create index characters_campaign_idx on public.characters (campaign_id);

alter table public.campaign_members
  add constraint campaign_members_character_fk foreign key (character_id) references public.characters (id) on delete set null;

create table public.custom_systems (
  id text primary key check (id like 'custom\_%'),
  owner_id text not null references public.profiles (id) on delete cascade,
  system jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index custom_systems_owner_idx on public.custom_systems (owner_id);

create table public.library_assets (
  id text primary key default gen_random_uuid()::text,
  owner_id text not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('scenario', 'resource')),
  title text not null,
  description text not null default '',
  biome text,
  category text,
  tags text[] not null default '{}',
  system_ids text[] not null default '{}',
  item_count integer not null default 0,
  preview_gradient text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- GM tools and maps
-- ---------------------------------------------------------------------------

create table public.saved_maps (
  id text primary key,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  name text not null,
  created_by text not null references public.profiles (id) on delete cascade,
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_maps_campaign_idx on public.saved_maps (campaign_id);

create table public.npcs (
  id text primary key default gen_random_uuid()::text,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  concept text not null default '',
  attitude text not null default 'neutral' check (attitude in ('ally', 'neutral', 'hostile')),
  portrait_color text not null,
  model_id text,
  location text not null default '',
  description text not null default '',
  secret_notes text not null default '',
  facts jsonb not null default '[]'::jsonb,
  stats jsonb not null,
  known boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index npcs_campaign_idx on public.npcs (campaign_id);

create table public.encounters (
  id text primary key default gen_random_uuid()::text,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  name text not null,
  description text not null default '',
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index encounters_campaign_idx on public.encounters (campaign_id);

create table public.journal_entries (
  id text primary key default gen_random_uuid()::text,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  at timestamptz not null,
  session_label text not null,
  kind text not null check (kind in ('combat', 'down', 'trap', 'epic', 'critical', 'reveal', 'map', 'note')),
  text text not null check (char_length(text) between 1 and 500),
  private boolean not null default false,
  source_id text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, source_id)
);
create index journal_entries_campaign_idx on public.journal_entries (campaign_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'campaigns', 'game_sessions', 'campaign_invites', 'characters', 'custom_systems', 'library_assets', 'saved_maps', 'npcs', 'encounters', 'journal_entries'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Permission helpers (security definer: they read membership without
-- recursing into the policies that use them)
-- ---------------------------------------------------------------------------

create function public.me() returns text language sql stable as $$ select auth.uid()::text $$;

create function public.my_email() returns text language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create function public.is_member(cid text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_members where campaign_id = cid and user_id = auth.uid()::text)
$$;

create function public.is_gm(cid text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_members where campaign_id = cid and user_id = auth.uid()::text and role = 'game_master')
$$;

create function public.is_owner(cid text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaigns where id = cid and owner_id = auth.uid()::text)
$$;

create function public.shares_campaign(other text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from campaign_members a join campaign_members b on a.campaign_id = b.campaign_id
    where a.user_id = auth.uid()::text and b.user_id = other
  )
$$;

create function public.has_pending_invite(cid text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_invites where campaign_id = cid and email = public.my_email() and status = 'pending')
$$;

-- ---------------------------------------------------------------------------
-- New users get a profile (display name from sign-up metadata, unique username)
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9._-]', '.', 'g');
  candidate text;
  n integer := 1;
  colors text[] := array['oklch(0.62 0.16 30)', 'oklch(0.62 0.14 70)', 'oklch(0.6 0.13 150)', 'oklch(0.6 0.13 230)', 'oklch(0.6 0.15 300)', 'oklch(0.62 0.15 340)'];
begin
  if char_length(base) < 2 then base := 'aventureiro'; end if;
  base := left(base, 34);
  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n;
  end loop;
  insert into profiles (id, email, display_name, username, avatar_color)
  values (
    new.id::text,
    lower(new.email),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), base), 60),
    candidate,
    colors[1 + (abs(hashtext(new.id::text)) % array_length(colors, 1))]
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Username availability without exposing other profiles.
create function public.username_taken(candidate text, except_user text default null) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where username = candidate and id is distinct from except_user)
$$;

-- ---------------------------------------------------------------------------
-- Campaign rules the policies can't express on their own
-- ---------------------------------------------------------------------------

-- The creator joins as GM.
create function public.add_owner_as_gm() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into campaign_members (campaign_id, user_id, role) values (new.id, new.owner_id, 'game_master');
  return new;
end $$;
create trigger campaigns_owner_member after insert on public.campaigns for each row execute function public.add_owner_as_gm();

-- Only the creator changes roles; the creator stays GM; a member links only their own character.
create function public.guard_member_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.campaign_id <> old.campaign_id or new.user_id <> old.user_id then
    raise exception 'Membro não pode mudar de campanha.' using errcode = '42501';
  end if;
  if new.role <> old.role then
    if not public.is_owner(new.campaign_id) then
      raise exception 'Só quem criou a campanha muda os papéis.' using errcode = '42501';
    end if;
    if new.user_id = (select owner_id from campaigns where id = new.campaign_id) and new.role <> 'game_master' then
      raise exception 'Quem criou a campanha continua mestre.' using errcode = '42501';
    end if;
  end if;
  if new.character_id is distinct from old.character_id and new.character_id is not null
     and not exists (select 1 from characters where id = new.character_id and owner_id = new.user_id) then
    raise exception 'O personagem precisa ser de quem o vincula.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger campaign_members_guard before update on public.campaign_members for each row execute function public.guard_member_update();

-- The creator is never removed, and a campaign always keeps a GM.
create function public.guard_member_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Cascades from a deleted campaign/profile are fine.
  if not exists (select 1 from campaigns where id = old.campaign_id) then return old; end if;
  if old.user_id = (select owner_id from campaigns where id = old.campaign_id) then
    raise exception 'Quem criou a campanha não pode ser removido.' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger campaign_members_guard_delete before delete on public.campaign_members for each row execute function public.guard_member_delete();

-- Accepting an invite: atomically checks the e-mail, the status and the free seats.
create function public.accept_invite(invite_id text) returns void language plpgsql security definer set search_path = public as $$
declare
  inv campaign_invites;
  seats integer;
  taken integer;
begin
  select * into inv from campaign_invites where id = invite_id for update;
  if inv.id is null or inv.email <> public.my_email() then raise exception 'Convite não encontrado.' using errcode = 'P0002'; end if;
  if inv.status <> 'pending' then raise exception 'Este convite já foi respondido.' using errcode = '22023'; end if;
  select (player_policy ->> 'maxPlayers')::integer into seats from campaigns where id = inv.campaign_id for update;
  select count(*) into taken from campaign_members where campaign_id = inv.campaign_id and role = 'player';
  if taken >= coalesce(seats, 0) then raise exception 'A campanha já está com todas as vagas preenchidas.' using errcode = '22023'; end if;
  insert into campaign_members (campaign_id, user_id, role) values (inv.campaign_id, auth.uid()::text, 'player')
    on conflict (campaign_id, user_id) do nothing;
  update campaign_invites set status = 'accepted' where id = invite_id;
end $$;

-- ---------------------------------------------------------------------------
-- Reads that strip secrets
-- ---------------------------------------------------------------------------

-- The party of a campaign: full rows for your own characters (and all of them
-- for the GM); for other players' characters, no sheet (private notes live there).
create function public.campaign_characters(cid text) returns setof public.characters language sql stable security definer set search_path = public as $$
  select c.id, c.owner_id, c.campaign_id, c.system_id, c.name, c.concept, c.level, c.portrait_color, c.avatar_url, c.resources, c.tags,
         case when c.owner_id = auth.uid()::text or public.is_gm(cid) then c.sheet else null end,
         c.created_at, c.updated_at
  from characters c
  where c.campaign_id = cid and public.is_member(cid)
$$;

-- NPCs the party knows: public fields and revealed facts only.
create function public.known_npcs(cid text) returns setof public.npcs language sql stable security definer set search_path = public as $$
  select n.id, n.campaign_id, n.name, n.concept, 'neutral'::text, n.portrait_color, null::text, n.location, n.description, ''::text,
         coalesce((select jsonb_agg(f) from jsonb_array_elements(n.facts) f where coalesce((f ->> 'revealed')::boolean, false)), '[]'::jsonb),
         '{}'::jsonb, true, n.created_at, n.updated_at
  from npcs n
  where n.campaign_id = cid and n.known and public.is_member(cid)
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.game_sessions enable row level security;
alter table public.campaign_invites enable row level security;
alter table public.characters enable row level security;
alter table public.custom_systems enable row level security;
alter table public.library_assets enable row level security;
alter table public.saved_maps enable row level security;
alter table public.npcs enable row level security;
alter table public.encounters enable row level security;
alter table public.journal_entries enable row level security;

-- Profiles: yourself and the people you play with.
create policy profiles_read on public.profiles for select to authenticated using (id = public.me() or public.shares_campaign(id));
create policy profiles_update on public.profiles for update to authenticated using (id = public.me()) with check (id = public.me());

-- Campaigns: members read; GMs edit; the creator deletes.
create policy campaigns_read on public.campaigns for select to authenticated using (public.is_member(id) or owner_id = public.me());
create policy campaigns_insert on public.campaigns for insert to authenticated with check (owner_id = public.me());
create policy campaigns_update on public.campaigns for update to authenticated using (public.is_gm(id)) with check (public.is_gm(id));
create policy campaigns_delete on public.campaigns for delete to authenticated using (owner_id = public.me());

-- Members: GMs add people; the creator changes roles (trigger); a member edits
-- their own row (character link only, trigger); GMs remove players, the creator removes GMs.
create policy members_read on public.campaign_members for select to authenticated using (public.is_member(campaign_id));
create policy members_insert on public.campaign_members for insert to authenticated with check (public.is_gm(campaign_id));
create policy members_update on public.campaign_members for update to authenticated
  using (public.is_owner(campaign_id) or user_id = public.me())
  with check (public.is_owner(campaign_id) or user_id = public.me());
create policy members_delete on public.campaign_members for delete to authenticated
  using (public.is_owner(campaign_id) or (public.is_gm(campaign_id) and role = 'player' and user_id <> public.me()));

-- Sessions: members read; GMs write.
create policy sessions_read on public.game_sessions for select to authenticated using (public.is_member(campaign_id));
create policy sessions_write on public.game_sessions for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

-- Invites: GMs manage theirs; the invitee sees and declines (accepting goes through accept_invite).
create policy invites_read on public.campaign_invites for select to authenticated using (public.is_gm(campaign_id) or email = public.my_email());
create policy invites_insert on public.campaign_invites for insert to authenticated with check (public.is_gm(campaign_id) and invited_by_id = public.me());
create policy invites_update on public.campaign_invites for update to authenticated
  using (public.is_gm(campaign_id) or email = public.my_email())
  with check (public.is_gm(campaign_id) or (email = public.my_email() and status = 'declined'));

-- Characters: the owner, and the GM of the character's campaign. Other members
-- see the party through campaign_characters() (without sheets).
create policy characters_read on public.characters for select to authenticated using (owner_id = public.me() or (campaign_id is not null and public.is_gm(campaign_id)));
create policy characters_insert on public.characters for insert to authenticated with check (owner_id = public.me() and (campaign_id is null or public.is_member(campaign_id)));
create policy characters_update on public.characters for update to authenticated
  using (owner_id = public.me() or (campaign_id is not null and public.is_gm(campaign_id)))
  with check (owner_id = public.me() or campaign_id is null or public.is_gm(campaign_id));
create policy characters_delete on public.characters for delete to authenticated using (owner_id = public.me());

-- Custom systems: the owner edits; members of campaigns that use one can read it.
create policy systems_read on public.custom_systems for select to authenticated using (
  owner_id = public.me()
  or exists (select 1 from public.campaigns c where c.system_id = custom_systems.id and public.is_member(c.id))
);
create policy systems_write on public.custom_systems for all to authenticated using (owner_id = public.me()) with check (owner_id = public.me());

-- Library: personal.
create policy library_owner on public.library_assets for all to authenticated using (owner_id = public.me()) with check (owner_id = public.me());

-- Maps, NPCs, encounters: GM only (players get known NPCs through known_npcs()).
create policy maps_gm on public.saved_maps for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy npcs_gm on public.npcs for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy encounters_gm on public.encounters for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

-- Journal: GMs everything; players the public, not-dismissed entries.
create policy journal_read on public.journal_entries for select to authenticated using (
  public.is_gm(campaign_id) or (public.is_member(campaign_id) and not private and not dismissed)
);
create policy journal_write on public.journal_entries for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

-- Functions callable by signed-in users only.
revoke execute on function public.accept_invite(text), public.campaign_characters(text), public.known_npcs(text), public.username_taken(text, text) from public, anon;
grant execute on function public.accept_invite(text), public.campaign_characters(text), public.known_npcs(text), public.username_taken(text, text) to authenticated;
