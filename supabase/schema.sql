-- Kickoff: pickup soccer organiser. Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ───────────── Profiles ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before this schema was run have no profile yet.
insert into public.profiles (id, display_name, avatar_url)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name',
                u.raw_user_meta_data->>'name',
                split_part(u.email, '@', 1)),
       u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ───────────── Matches ─────────────
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text,
  venue_name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  starts_at timestamptz not null,
  duration_min int not null default 90 check (duration_min between 15 and 360),
  -- player limits
  min_players int not null default 6 check (min_players >= 2),
  max_players int not null default 14 check (max_players <= 60),
  price_cents int not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'open' check (status in ('open','cancelled','completed')),
  created_at timestamptz not null default now(),
  constraint players_range check (max_players >= min_players)
);
create index matches_starts_at_idx on public.matches (starts_at);
create index matches_geo_idx on public.matches (lat, lng);

-- The host automatically takes the first spot (no payment needed for their own game).
create or replace function public.host_joins_own_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.rsvps (match_id, user_id, status) values (new.id, new.host_id, 'going');
  return new;
end $$;

-- ───────────── RSVPs ─────────────
-- going            : confirmed spot (free match, or paid and settled)
-- pending_payment  : spot held for 15 minutes while the player pays
-- waitlist         : match is full; promoted automatically when a spot frees up
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going','pending_payment','waitlist')),
  hold_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create trigger matches_host_joins after insert on public.matches
  for each row execute function public.host_joins_own_match();

-- ───────────── Polls & votes ─────────────
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  kind text not null check (kind in ('time','location')),
  question text not null,
  closes_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  starts_at timestamptz,
  venue_name text,
  lat double precision,
  lng double precision
);

create table public.votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)          -- one vote per member per poll; re-voting overwrites
);

-- ───────────── Payments ─────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe','venmo')),
  provider_ref text not null,
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null check (status in ('pending','succeeded','failed','refunded')),
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

-- ───────────── Views ─────────────
create or replace view public.match_overview as
select
  m.*,
  p.display_name as host_name,
  coalesce(c.going, 0)    as going_count,
  coalesce(c.held, 0)     as held_count,
  coalesce(c.waiting, 0)  as waitlist_count,
  greatest(m.max_players - coalesce(c.going,0) - coalesce(c.held,0), 0) as spots_left,
  coalesce(c.going,0) >= m.min_players as is_confirmed,
  greatest(m.min_players - coalesce(c.going,0), 0) as players_needed
from public.matches m
join public.profiles p on p.id = m.host_id
left join lateral (
  select
    count(*) filter (where r.status = 'going') as going,
    count(*) filter (where r.status = 'pending_payment' and r.hold_expires_at > now()) as held,
    count(*) filter (where r.status = 'waitlist') as waiting
  from public.rsvps r where r.match_id = m.id
) c on true;

create or replace view public.poll_results as
select o.poll_id, o.id as option_id, count(v.user_id) as vote_count
from public.poll_options o
left join public.votes v on v.option_id = o.id
group by o.poll_id, o.id;

-- ───────────── Join / leave logic (enforces max players atomically) ─────────────
create or replace function public.join_match(p_match uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  taken int;
  new_status text;
begin
  select * into m from public.matches where id = p_match for update;   -- serialise joins
  if not found or m.status <> 'open' then raise exception 'Match is not open'; end if;
  if m.starts_at < now() then raise exception 'Match already started'; end if;

  delete from public.rsvps where match_id = p_match and user_id = auth.uid()
    and status = 'pending_payment' and hold_expires_at < now();
  if exists (select 1 from public.rsvps where match_id = p_match and user_id = auth.uid()) then
    return (select status from public.rsvps where match_id = p_match and user_id = auth.uid());
  end if;

  select count(*) into taken from public.rsvps
   where match_id = p_match
     and (status = 'going' or (status = 'pending_payment' and hold_expires_at > now()));

  if taken >= m.max_players then
    new_status := 'waitlist';
  elsif m.price_cents > 0 then
    new_status := 'pending_payment';
  else
    new_status := 'going';
  end if;

  insert into public.rsvps (match_id, user_id, status, hold_expires_at)
  values (p_match, auth.uid(), new_status,
          case when new_status = 'pending_payment' then now() + interval '15 minutes' end);
  return new_status;
end $$;

create or replace function public.leave_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  next_id uuid;
begin
  select * into m from public.matches where id = p_match for update;
  delete from public.rsvps where match_id = p_match and user_id = auth.uid();

  -- promote the longest-waiting player into the freed spot
  select id into next_id from public.rsvps
   where match_id = p_match and status = 'waitlist'
   order by created_at limit 1;
  if next_id is not null then
    update public.rsvps
       set status = case when m.price_cents > 0 then 'pending_payment' else 'going' end,
           hold_expires_at = case when m.price_cents > 0 then now() + interval '15 minutes' end
     where id = next_id;
  end if;
end $$;

-- Called by the payment edge functions (service role) after money is captured.
create or replace function public.mark_rsvp_paid(p_match uuid, p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.rsvps set status = 'going', hold_expires_at = null
   where match_id = p_match and user_id = p_user;
$$;
revoke execute on function public.mark_rsvp_paid(uuid, uuid) from public, anon, authenticated;

-- Host can't lower max below current attendance or raise min above max.
create or replace function public.guard_player_limits() returns trigger
language plpgsql as $$
declare going int;
begin
  select count(*) into going from public.rsvps where match_id = new.id and status = 'going';
  if new.max_players < going then
    raise exception 'Max players (%) is below the % players already going', new.max_players, going;
  end if;
  return new;
end $$;
create trigger matches_guard_limits before update on public.matches
  for each row execute function public.guard_player_limits();

-- ───────────── Row level security ─────────────
alter table public.profiles     enable row level security;
alter table public.matches      enable row level security;
alter table public.rsvps        enable row level security;
alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes        enable row level security;
alter table public.payments     enable row level security;

create policy "profiles readable"  on public.profiles for select using (auth.role() = 'authenticated');
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

create policy "matches readable"   on public.matches for select using (auth.role() = 'authenticated');
create policy "host creates"       on public.matches for insert with check (auth.uid() = host_id);
create policy "host updates"       on public.matches for update using (auth.uid() = host_id);
create policy "host deletes"       on public.matches for delete using (auth.uid() = host_id);

create policy "rsvps readable"     on public.rsvps for select using (auth.role() = 'authenticated');
-- writes go through join_match / leave_match only

create policy "polls readable"     on public.polls for select using (auth.role() = 'authenticated');
create policy "member creates poll" on public.polls for insert
  with check (auth.uid() = created_by and exists (
    select 1 from public.matches m where m.id = match_id
      and (m.host_id = auth.uid() or exists (
        select 1 from public.rsvps r where r.match_id = m.id and r.user_id = auth.uid() and r.status = 'going'))));

create policy "options readable"   on public.poll_options for select using (auth.role() = 'authenticated');
create policy "poll owner adds options" on public.poll_options for insert
  with check (exists (select 1 from public.polls p where p.id = poll_id and p.created_by = auth.uid()));

create policy "votes readable"     on public.votes for select using (auth.role() = 'authenticated');
create policy "going members vote" on public.votes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.polls p join public.rsvps r on r.match_id = p.match_id
                where p.id = poll_id and r.user_id = auth.uid() and r.status = 'going'
                  and (p.closes_at is null or p.closes_at > now())));
create policy "change own vote" on public.votes for update using (auth.uid() = user_id);

create policy "see own payments"   on public.payments for select using (auth.uid() = user_id);

alter publication supabase_realtime add table public.votes, public.rsvps;
