-- Kickoff: two ways to pay for a game. Run once in the Supabase SQL editor, after 004_payouts.sql.
--
--   stripe : players pay in the app; the money goes to the host's own Stripe account
--   direct : players pay the organizer themselves (Venmo, Zelle, cash). Joining takes the spot straight
--            away; the host or a group organizer marks each player paid, and can remove anyone who doesn't.

alter table public.matches
  add column payment_method text not null default 'stripe' check (payment_method in ('stripe','direct')),
  add column payment_instructions text check (char_length(payment_instructions) <= 300),
  add constraint direct_needs_instructions check (
    price_cents = 0 or payment_method = 'stripe' or coalesce(trim(payment_instructions), '') <> '');

alter table public.rsvps add column paid_at timestamptz;

-- Only in-app (Stripe) payments need the host to have payouts set up.
create or replace function public.guard_paid_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.price_cents > 0 and new.payment_method = 'stripe'
     and (tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents
          or new.host_id is distinct from old.host_id or new.payment_method is distinct from old.payment_method)
     and not exists (select 1 from public.payout_accounts where user_id = new.host_id and charges_enabled) then
    raise exception 'Set up payouts before posting a game with in-app payment';
  end if;
  return new;
end $$;

-- Host, the group's organizers, or an admin.
create or replace function public.can_manage_match(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches m where m.id = p_match and (
    m.host_id = auth.uid() or public.is_group_organizer(m.group_id) or public.my_role() = 'admin'));
$$;

-- ───────────── Joining ─────────────
-- Same as before, except direct-payment games give a spot straight away (no 15 minute hold).
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
  if m.visibility = 'group' and not public.is_group_member(m.group_id) then
    raise exception 'This game is for group members only';
  end if;

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
  elsif m.price_cents > 0 and m.payment_method = 'stripe' then
    new_status := 'pending_payment';
  else
    new_status := 'going';
  end if;

  insert into public.rsvps (match_id, user_id, status, hold_expires_at)
  values (p_match, auth.uid(), new_status,
          case when new_status = 'pending_payment' then now() + interval '15 minutes' end);
  return new_status;
end $$;

-- ───────────── Leaving / removing ─────────────
-- Players remove themselves; the host or group organizers can remove anyone.
-- The longest-waiting player is promoted into the freed spot.
create or replace function public.remove_player(p_match uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  next_id uuid;
begin
  if p_user <> auth.uid() and not public.can_manage_match(p_match) then
    raise exception 'Only the organizers can remove players';
  end if;
  select * into m from public.matches where id = p_match for update;
  if m.host_id = p_user then raise exception 'The host can''t be removed. Cancel the game instead.'; end if;
  delete from public.rsvps where match_id = p_match and user_id = p_user;

  select id into next_id from public.rsvps
   where match_id = p_match and status = 'waitlist'
   order by created_at limit 1;
  if next_id is not null then
    update public.rsvps
       set status = case when m.price_cents > 0 and m.payment_method = 'stripe' then 'pending_payment' else 'going' end,
           hold_expires_at = case when m.price_cents > 0 and m.payment_method = 'stripe' then now() + interval '15 minutes' end
     where id = next_id;
  end if;
end $$;

create or replace function public.leave_match(p_match uuid) returns void
language sql security definer set search_path = public as $$
  select public.remove_player(p_match, auth.uid());
$$;

-- ───────────── Paid status ─────────────
create or replace function public.set_player_paid(p_match uuid, p_user uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_match(p_match) then raise exception 'Only the organizers can mark payments'; end if;
  update public.rsvps set paid_at = case when p_paid then now() end
   where match_id = p_match and user_id = p_user;
end $$;

-- Stripe's webhook: now also records when the player paid.
create or replace function public.mark_rsvp_paid(p_match uuid, p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.rsvps set status = 'going', hold_expires_at = null, paid_at = now()
   where match_id = p_match and user_id = p_user;
$$;
revoke execute on function public.mark_rsvp_paid(uuid, uuid) from public, anon, authenticated;

-- ───────────── Overview (picks up the new columns) ─────────────
drop view public.match_overview;
create view public.match_overview with (security_invoker = true) as
select
  m.*,
  p.display_name as host_name,
  g.name as group_name,
  coalesce(c.going, 0)    as going_count,
  coalesce(c.held, 0)     as held_count,
  coalesce(c.waiting, 0)  as waitlist_count,
  greatest(m.max_players - coalesce(c.going,0) - coalesce(c.held,0), 0) as spots_left,
  coalesce(c.going,0) >= m.min_players as is_confirmed,
  greatest(m.min_players - coalesce(c.going,0), 0) as players_needed
from public.matches m
join public.profiles p on p.id = m.host_id
left join public.groups g on g.id = m.group_id
left join lateral (
  select
    count(*) filter (where r.status = 'going') as going,
    count(*) filter (where r.status = 'pending_payment' and r.hold_expires_at > now()) as held,
    count(*) filter (where r.status = 'waitlist') as waiting
  from public.rsvps r where r.match_id = m.id
) c on true;
