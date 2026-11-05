-- Role Quest — access hardening.
--
-- Closes paths found in review: ownership changes (campaigns, characters),
-- GMs adding people without an invite, GM notes readable by players, custom
-- systems readable through someone else's campaign, characters moved into
-- campaigns their owner doesn't play in, profile e-mail rewrites, invite edits.
--
-- Guards skip writes made inside our security-definer functions (they run as
-- the function owner, not as `authenticated`/`anon`), e.g. accept_invite.

create function public.is_api_role() returns boolean language sql stable as $$
  select current_user in ('authenticated', 'anon')
$$;

-- ---------------------------------------------------------------------------
-- GM notes: own table, GMs only (the campaign row is readable by every member)
-- ---------------------------------------------------------------------------

create table public.campaign_gm_notes (
  campaign_id text primary key references public.campaigns (id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campaign_gm_notes_touch before update on public.campaign_gm_notes for each row execute function public.touch_updated_at();
alter table public.campaign_gm_notes enable row level security;
create policy gm_notes_gm on public.campaign_gm_notes for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

insert into public.campaign_gm_notes (campaign_id, notes)
  select id, game_master ->> 'notes' from public.campaigns where coalesce(game_master ->> 'notes', '') <> '';
update public.campaigns set game_master = game_master - 'notes' where game_master ? 'notes';

-- ---------------------------------------------------------------------------
-- Campaigns: the owner never changes; GM notes never land in the shared row
-- ---------------------------------------------------------------------------

create function public.guard_campaign_write() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.owner_id <> old.owner_id) then
    raise exception 'A campanha não muda de dono.' using errcode = '42501';
  end if;
  new.game_master := coalesce(new.game_master, '{}'::jsonb) - 'notes';
  return new;
end $$;
create trigger campaigns_guard before insert or update on public.campaigns for each row execute function public.guard_campaign_write();

-- ---------------------------------------------------------------------------
-- Members: nobody inserts directly. People join through accept_invite; the
-- creator through the campaign trigger.
-- ---------------------------------------------------------------------------

drop policy members_insert on public.campaign_members;

-- The linked character must be the member's own, and already in this campaign.
create or replace function public.guard_member_update() returns trigger language plpgsql security definer set search_path = public as $$
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
     and not exists (select 1 from characters where id = new.character_id and owner_id = new.user_id and campaign_id = new.campaign_id) then
    raise exception 'O personagem precisa ser de quem o vincula e estar nesta campanha.' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Characters: the owner never changes; only the owner moves a character into
-- a campaign (one they play in); a GM can only take it out (removing a player).
-- ---------------------------------------------------------------------------

create function public.guard_character_update() returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  if new.id <> old.id or new.owner_id <> old.owner_id then
    raise exception 'O personagem não muda de dono.' using errcode = '42501';
  end if;
  if new.campaign_id is distinct from old.campaign_id and new.campaign_id is not null
     and (old.owner_id <> public.me() or not public.is_member(new.campaign_id)) then
    raise exception 'Só quem joga na campanha leva um personagem para ela.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger characters_guard before update on public.characters for each row execute function public.guard_character_update();

-- The party: characters of current members only.
create or replace function public.campaign_characters(cid text) returns setof public.characters language sql stable security definer set search_path = public as $$
  select c.id, c.owner_id, c.campaign_id, c.system_id, c.name, c.concept, c.level, c.portrait_color, c.avatar_url, c.resources, c.tags,
         case when c.owner_id = auth.uid()::text or public.is_gm(cid) then c.sheet else null end,
         c.created_at, c.updated_at
  from characters c
  where c.campaign_id = cid and public.is_member(cid)
    and exists (select 1 from campaign_members m where m.campaign_id = cid and m.user_id = c.owner_id)
  order by c.created_at
$$;

create or replace function public.known_npcs(cid text) returns setof public.npcs language sql stable security definer set search_path = public as $$
  select n.id, n.campaign_id, n.name, n.concept, 'neutral'::text, n.portrait_color, null::text, n.location, n.description, ''::text,
         coalesce((select jsonb_agg(f) from jsonb_array_elements(n.facts) f where coalesce((f ->> 'revealed')::boolean, false)), '[]'::jsonb),
         '{}'::jsonb, true, n.created_at, n.updated_at
  from npcs n
  where n.campaign_id = cid and n.known and public.is_member(cid)
  order by n.name
$$;

-- ---------------------------------------------------------------------------
-- Custom systems: readable by members (and invitees) of campaigns whose
-- creator owns the system — not through any campaign that names its id.
-- ---------------------------------------------------------------------------

create function public.can_read_system(sid text, sowner text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from campaigns c
    where c.system_id = sid and c.owner_id = sowner and (public.is_member(c.id) or public.has_pending_invite(c.id))
  )
$$;

drop policy systems_read on public.custom_systems;
create policy systems_read on public.custom_systems for select to authenticated using (owner_id = public.me() or public.can_read_system(id, owner_id));

-- ---------------------------------------------------------------------------
-- Invites: the invitee only declines a pending one; nobody moves an invite.
-- ---------------------------------------------------------------------------

create function public.guard_invite_update() returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  if new.campaign_id <> old.campaign_id or new.email <> old.email then
    raise exception 'O convite não muda de campanha nem de destinatário.' using errcode = '42501';
  end if;
  if public.is_gm(old.campaign_id) then return new; end if;
  if old.status <> 'pending' or new.status <> 'declined'
     or (new.campaign_name, new.system_id, new.invited_by_id, new.invited_by_name, new.message)
        is distinct from (old.campaign_name, old.system_id, old.invited_by_id, old.invited_by_name, old.message) then
    raise exception 'Você só pode recusar um convite pendente.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger campaign_invites_guard before update on public.campaign_invites for each row execute function public.guard_invite_update();

-- ---------------------------------------------------------------------------
-- Profiles: id and e-mail come from Auth; usernames follow the app's rule.
-- ---------------------------------------------------------------------------

create function public.guard_profile_update() returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_api_role() and (new.id <> old.id or new.email <> old.email) then
    raise exception 'O e-mail da conta não muda pelo perfil.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

-- Same rule as USERNAME_PATTERN in src/services/profile.service.ts (existing rows are kept).
alter table public.profiles drop constraint profiles_username_check;
alter table public.profiles add constraint profiles_username_check check (username ~ '^[a-z0-9._]{3,20}$') not valid;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9._]', '.', 'g'), 16);
  candidate text;
  n integer := 1;
  colors text[] := array['oklch(0.62 0.16 30)', 'oklch(0.62 0.14 70)', 'oklch(0.6 0.13 150)', 'oklch(0.6 0.13 230)', 'oklch(0.6 0.15 300)', 'oklch(0.62 0.15 340)'];
begin
  if char_length(base) < 3 then base := 'aventureiro'; end if;
  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n;
  end loop;
  insert into profiles (id, email, display_name, username, avatar_color)
  values (
    new.id::text,
    lower(coalesce(new.email, '')),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), base), 60),
    candidate,
    colors[1 + (abs(hashtext(new.id::text)) % array_length(colors, 1))]
  );
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Membership helpers: signed-in users only (the policies call them as `authenticated`).
-- ---------------------------------------------------------------------------

revoke execute on function
  public.is_member(text), public.is_gm(text), public.is_owner(text),
  public.shares_campaign(text), public.has_pending_invite(text), public.can_read_system(text, text)
from public, anon;
grant execute on function
  public.is_member(text), public.is_gm(text), public.is_owner(text),
  public.shares_campaign(text), public.has_pending_invite(text), public.can_read_system(text, text)
to authenticated;
