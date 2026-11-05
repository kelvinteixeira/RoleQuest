-- Role Quest — invite links replace e-mail invites.
--
-- The GM shares a link (a random code) anywhere; whoever opens it signed in
-- joins as a player while there are free seats. The GM can replace the code
-- (old links stop working) or turn the link off. No e-mail involved.

-- ---------------------------------------------------------------------------
-- Out: e-mail invites
-- ---------------------------------------------------------------------------

drop function public.accept_invite(text);
drop table public.campaign_invites;
drop function public.guard_invite_update();

-- Custom systems: members of the owner's campaigns that use them (no invitees any more).
create or replace function public.can_read_system(sid text, sowner text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaigns c where c.system_id = sid and c.owner_id = sowner and public.is_member(c.id))
$$;
drop function public.has_pending_invite(text);
drop function public.my_email();

-- ---------------------------------------------------------------------------
-- In: one invite link per campaign, readable only by its GMs
-- ---------------------------------------------------------------------------

create table public.campaign_invite_links (
  campaign_id text primary key references public.campaigns (id) on delete cascade,
  -- A v4 UUID (122 random bits) without dashes; the GM never picks it.
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.campaign_invite_links enable row level security;
create policy invite_links_gm_read on public.campaign_invite_links for select to authenticated using (public.is_gm(campaign_id));
create policy invite_links_gm_delete on public.campaign_invite_links for delete to authenticated using (public.is_gm(campaign_id));
-- Codes come from new_invite_link() only, never from the client.

-- Campaigns created before this migration get their link too.
insert into public.campaign_invite_links (campaign_id) select id from public.campaigns on conflict do nothing;

-- Creates the campaign's link, or replaces its code (old links stop working).
create function public.new_invite_link(cid text) returns public.campaign_invite_links language plpgsql security definer set search_path = public as $$
declare
  link campaign_invite_links;
begin
  if not public.is_gm(cid) then raise exception 'Só os mestres da campanha geram o link de convite.' using errcode = '42501'; end if;
  insert into campaign_invite_links (campaign_id) values (cid)
    on conflict (campaign_id) do update set code = replace(gen_random_uuid()::text, '-', ''), created_at = now()
    returning * into link;
  return link;
end $$;

-- What the link opens, before joining: enough to decide, nothing private.
create function public.invite_preview(invite_code text)
returns table (campaign_id text, campaign_name text, tagline text, system_id text, system_name text, game_master_name text, free_seats integer, already_member boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.tagline, c.system_id,
         -- Custom systems are readable only after joining: their name comes along here.
         cs.system ->> 'name',
         coalesce(nullif(c.game_master ->> 'narratorName', ''), p.display_name),
         greatest(coalesce((c.player_policy ->> 'maxPlayers')::integer, 0) - (select count(*)::integer from campaign_members m where m.campaign_id = c.id and m.role = 'player'), 0),
         exists (select 1 from campaign_members m where m.campaign_id = c.id and m.user_id = auth.uid()::text)
  from campaign_invite_links l
  join campaigns c on c.id = l.campaign_id
  join profiles p on p.id = c.owner_id
  left join custom_systems cs on cs.id = c.system_id and cs.owner_id = c.owner_id
  where l.code = invite_code and auth.uid() is not null
$$;

-- Joining by link: atomically checks the code and the free seats. Returns the campaign id.
create function public.join_campaign(invite_code text) returns text language plpgsql security definer set search_path = public as $$
declare
  cid text;
  seats integer;
  taken integer;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para usar o convite.' using errcode = '42501'; end if;
  select l.campaign_id into cid from campaign_invite_links l where l.code = invite_code;
  if cid is null then raise exception 'Este link de convite não vale mais. Peça um novo ao mestre.' using errcode = 'P0002'; end if;
  -- Lock first: two tabs joining at once see each other.
  select (player_policy ->> 'maxPlayers')::integer into seats from campaigns where id = cid for update;
  if exists (select 1 from campaign_members where campaign_id = cid and user_id = auth.uid()::text) then return cid; end if;
  select count(*) into taken from campaign_members where campaign_id = cid and role = 'player';
  if taken >= coalesce(seats, 0) then raise exception 'A campanha já está com todas as vagas preenchidas.' using errcode = '22023'; end if;
  insert into campaign_members (campaign_id, user_id, role) values (cid, auth.uid()::text, 'player')
    on conflict (campaign_id, user_id) do nothing;
  return cid;
end $$;

revoke execute on function public.can_read_system(text, text), public.new_invite_link(text), public.invite_preview(text), public.join_campaign(text) from public, anon;
grant execute on function public.can_read_system(text, text), public.new_invite_link(text), public.invite_preview(text), public.join_campaign(text) to authenticated;
