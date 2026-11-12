-- Launch: account deletion (LGPD), plans and AI credits, session reminders.
--
-- Plans are written only by the billing webhook (service role). Limits apply
-- once billing is switched on: `update billing_config set enforce = true;`
-- Until then everyone keeps the paid allowances (nobody can pay yet).

-- ---------------------------------------------------------------------------
-- Account deletion: the user's campaigns go first (their members would block
-- a cascade from the profile), then the profile, then the auth user.
-- Files in Storage under those campaigns are removed by the API route.
-- ---------------------------------------------------------------------------

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.uid()::text;
begin
  if uid is null then raise exception 'Entre na sua conta para excluí-la.' using errcode = '42501'; end if;
  delete from campaigns where owner_id = uid;
  delete from profiles where id = uid;
  delete from auth.users where id = uid::uuid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------

create table public.billing_config (
  id boolean primary key default true check (id),
  enforce boolean not null default false
);
insert into public.billing_config default values;
alter table public.billing_config enable row level security;
create policy billing_config_read on public.billing_config for select to authenticated, anon using (true);

create table public.subscriptions (
  user_id text primary key references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('free', 'mestre', 'mesa')),
  status text not null default 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_own on public.subscriptions for select to authenticated using (user_id = auth.uid()::text);

create table public.ai_credits (
  user_id text primary key references public.profiles (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.ai_credits enable row level security;
create policy ai_credits_own on public.ai_credits for select to authenticated using (user_id = auth.uid()::text);

-- Stripe events already handled (the webhook may deliver one twice).
create table public.billing_events (
  id text primary key,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;

create function public.billing_enforced() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enforce from billing_config), false)
$$;

/** The plan a user has now: a paid one while the subscription is active, else free (or "mestre" before billing is on). */
create function public.plan_of(uid text) returns text language sql stable security definer set search_path = public as $$
  select case
    when not public.billing_enforced() then 'mestre'
    else coalesce(
      (select plan from subscriptions
        where user_id = uid and status in ('active', 'trialing', 'past_due')
          and (current_period_end is null or current_period_end > now() - interval '3 days')),
      'free')
  end
$$;
grant execute on function public.plan_of(text) to authenticated;

create function public.my_plan() returns text language sql stable security definer set search_path = public as $$
  select public.plan_of(auth.uid()::text)
$$;
grant execute on function public.my_plan() to authenticated;

/** Daily AI allowance per plan; credits pay for what goes over (script 5, image 1, voice 1). */
create or replace function public.spend_chronicle_quota(cid text, what text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  plan text := public.plan_of(auth.uid()::text);
  allowance integer := case what
    when 'script' then case plan when 'free' then 3 when 'mesa' then 40 else 20 end
    when 'image' then case plan when 'free' then 30 when 'mesa' then 240 else 120 end
    when 'voice' then case plan when 'free' then 40 when 'mesa' then 400 else 200 end
    else 0 end;
  price integer := case what when 'script' then 5 else 1 end;
  used integer;
begin
  if not public.is_gm(cid) then raise exception 'Só os mestres da campanha criam episódios.' using errcode = '42501'; end if;
  if allowance = 0 then raise exception 'Uso desconhecido.' using errcode = '22023'; end if;
  insert into chronicle_usage (user_id, kind, count) values (auth.uid()::text, what, 1)
    on conflict (user_id, day, kind) do update set count = chronicle_usage.count + 1
    returning count into used;
  if used <= allowance then return true; end if;
  -- Over the allowance: credits, if there are enough.
  update ai_credits set balance = balance - price, updated_at = now()
    where user_id = auth.uid()::text and balance >= price;
  if found then return true; end if;
  update chronicle_usage set count = count - 1 where user_id = auth.uid()::text and day = current_date and kind = what;
  return false;
end $$;

/** What the account page shows: plan, renewal, credits and today's use. */
create function public.my_billing() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', public.plan_of(auth.uid()::text),
    'enforced', public.billing_enforced(),
    'status', (select status from subscriptions where user_id = auth.uid()::text),
    'renewsAt', (select current_period_end from subscriptions where user_id = auth.uid()::text),
    'cancelAtPeriodEnd', coalesce((select cancel_at_period_end from subscriptions where user_id = auth.uid()::text), false),
    'credits', coalesce((select balance from ai_credits where user_id = auth.uid()::text), 0),
    'usedToday', coalesce((select jsonb_object_agg(kind, count) from chronicle_usage where user_id = auth.uid()::text and day = current_date), '{}'::jsonb)
  )
$$;
grant execute on function public.my_billing() to authenticated;

-- Free plan: one campaign under way at a time (finished ones don't count).
create function public.guard_campaign_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.plan_of(new.owner_id) = 'free'
    and (select count(*) from campaigns where owner_id = new.owner_id and status <> 'completed') >= 1 then
    raise exception 'O plano grátis tem uma campanha em andamento por vez. Conclua a atual ou assine o plano Mestre.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger campaigns_plan_limit before insert on public.campaigns for each row execute function public.guard_campaign_limit();

-- ---------------------------------------------------------------------------
-- Session reminders: what was already sent (the cron job runs every hour).
-- ---------------------------------------------------------------------------

create table public.session_reminders (
  session_id text not null references public.game_sessions (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
alter table public.session_reminders enable row level security;

alter table public.profiles add column email_reminders boolean not null default true;
