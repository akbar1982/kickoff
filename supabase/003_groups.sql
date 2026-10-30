-- Kickoff: groups. Run once in the Supabase SQL editor, after 002_roles_and_chat.sql.
--
-- Anyone can start a group and becomes its organizer. Organizers invite people or approve
-- join requests, can make other members organizers, and post games for the group.
-- A game is either open to everyone or visible to group members only.
-- App-wide roles are now just admin (moderation) and participant (everyone else).

-- ───────────── App-wide roles: drop the global organizer ─────────────
update public.profiles set role = 'participant' where role = 'organizer';
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','participant'));

-- ───────────── Groups ─────────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),
  description text check (char_length(description) <= 500),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- active  : member
-- pending : asked to join, waiting for an organizer
-- invited : an organizer invited them, waiting for them to accept
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'participant' check (role in ('organizer','participant')),
  status text not null check (status in ('active','pending','invited')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create or replace function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid() and status = 'active');
$$;

create or replace function public.is_group_organizer(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid() and status = 'active' and role = 'organizer');
$$;

-- Whoever creates a group is its first organizer.
create or replace function public.creator_organizes_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role, status) values (new.id, new.created_by, 'organizer', 'active');
  return new;
end $$;
create trigger groups_creator_organizes after insert on public.groups
  for each row execute function public.creator_organizes_group();

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

create policy "groups readable"    on public.groups for select using (auth.role() = 'authenticated');
create policy "anyone starts a group" on public.groups for insert with check (auth.uid() = created_by);
create policy "organizers edit group" on public.groups for update
  using (public.is_group_organizer(id) or public.my_role() = 'admin');
create policy "organizers delete group" on public.groups for delete
  using (public.is_group_organizer(id) or public.my_role() = 'admin');

create policy "members readable" on public.group_members for select using (auth.role() = 'authenticated');
-- membership changes go through the functions below only

create or replace view public.group_overview with (security_invoker = true) as
select g.*,
  (select count(*) from public.group_members m where m.group_id = g.id and m.status = 'active')  as member_count,
  (select count(*) from public.group_members m where m.group_id = g.id and m.status = 'pending') as pending_count,
  me.status as my_status,
  me.role   as my_group_role
from public.groups g
left join public.group_members me on me.group_id = g.id and me.user_id = auth.uid();

-- ───────────── Membership actions ─────────────
-- Ask to join. If you were already invited, this accepts the invite.
create or replace function public.request_to_join(p_group uuid) returns text
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  select status into s from public.group_members where group_id = p_group and user_id = auth.uid();
  if s = 'invited' then
    update public.group_members set status = 'active' where group_id = p_group and user_id = auth.uid();
    return 'active';
  elsif s is not null then
    return s;
  end if;
  insert into public.group_members (group_id, user_id, status) values (p_group, auth.uid(), 'pending');
  return 'pending';
end $$;

-- Organizer invites someone. If they had already asked to join, they're in.
create or replace function public.invite_to_group(p_group uuid, p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  if not public.is_group_organizer(p_group) then raise exception 'Only organizers can invite'; end if;
  select status into s from public.group_members where group_id = p_group and user_id = p_user;
  if s = 'pending' then
    update public.group_members set status = 'active' where group_id = p_group and user_id = p_user;
    return 'active';
  elsif s is not null then
    return s;
  end if;
  insert into public.group_members (group_id, user_id, status) values (p_group, p_user, 'invited');
  return 'invited';
end $$;

-- The invited user accepts or declines.
create or replace function public.respond_to_invite(p_group uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.group_members set status = 'active'
     where group_id = p_group and user_id = auth.uid() and status = 'invited';
  else
    delete from public.group_members where group_id = p_group and user_id = auth.uid() and status = 'invited';
  end if;
end $$;

-- An organizer approves or declines a join request.
create or replace function public.review_join_request(p_group uuid, p_user uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_organizer(p_group) then raise exception 'Only organizers can review requests'; end if;
  if p_approve then
    update public.group_members set status = 'active' where group_id = p_group and user_id = p_user and status = 'pending';
  else
    delete from public.group_members where group_id = p_group and user_id = p_user and status = 'pending';
  end if;
end $$;

-- A group must always keep at least one organizer.
create or replace function public.ensure_group_has_organizer(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.groups where id = p_group) and not exists (
    select 1 from public.group_members where group_id = p_group and role = 'organizer' and status = 'active'
  ) then
    raise exception 'A group needs at least one organizer. Make someone else an organizer first.';
  end if;
end $$;

create or replace function public.set_group_role(p_group uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_organizer(p_group) then raise exception 'Only organizers can change roles'; end if;
  update public.group_members set role = p_role where group_id = p_group and user_id = p_user and status = 'active';
  perform public.ensure_group_has_organizer(p_group);
end $$;

-- Organizers remove anyone (or cancel an invite); anyone can remove themselves (leave / withdraw request).
create or replace function public.remove_from_group(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user <> auth.uid() and not public.is_group_organizer(p_group) then
    raise exception 'Only organizers can remove members';
  end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
  perform public.ensure_group_has_organizer(p_group);
end $$;

-- ───────────── Games belong to a group ─────────────
alter table public.matches
  add column group_id uuid references public.groups(id) on delete cascade,
  add column visibility text not null default 'public' check (visibility in ('public','group')),
  add constraint group_only_needs_group check (visibility = 'public' or group_id is not null);
create index matches_group_idx on public.matches (group_id);

-- Who can see a game: open games are visible to everyone, group-only games to members.
create or replace function public.can_see_match(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches m where m.id = p_match and (
    m.visibility = 'public' or m.host_id = auth.uid()
    or public.is_group_member(m.group_id) or public.my_role() = 'admin'));
$$;

drop policy "matches readable" on public.matches;
create policy "matches readable" on public.matches for select using (
  auth.role() = 'authenticated' and (
    visibility = 'public' or host_id = auth.uid() or public.is_group_member(group_id) or public.my_role() = 'admin'));

drop policy "organizers create" on public.matches;
create policy "group organizers create" on public.matches for insert with check (
  auth.uid() = host_id and group_id is not null
  and (public.is_group_organizer(group_id) or public.my_role() = 'admin'));

create policy "group organizers update" on public.matches for update using (public.is_group_organizer(group_id));

-- Roster and votes follow the game's visibility.
drop policy "rsvps readable" on public.rsvps;
create policy "rsvps readable" on public.rsvps for select using (public.can_see_match(match_id));
drop policy "polls readable" on public.polls;
create policy "polls readable" on public.polls for select using (public.can_see_match(match_id));
drop policy "options readable" on public.poll_options;
create policy "options readable" on public.poll_options for select
  using (exists (select 1 from public.polls p where p.id = poll_id));
drop policy "votes readable" on public.votes;
create policy "votes readable" on public.votes for select
  using (exists (select 1 from public.polls p where p.id = poll_id));

-- The overview gains group columns. security_invoker makes it respect the policies above.
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

-- Same as before, plus: group-only games are for group members.
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

-- ───────────── Group chat ─────────────
alter table public.chat_messages
  add column group_id uuid references public.groups(id) on delete cascade,
  add constraint one_room check (match_id is null or group_id is null);
create index chat_messages_group_idx on public.chat_messages (group_id, created_at desc);

drop policy "read chat" on public.chat_messages;
drop policy "post chat" on public.chat_messages;
create policy "read chat" on public.chat_messages for select using (
  auth.role() = 'authenticated' and (
    (match_id is null and group_id is null)
    or (match_id is not null and public.can_use_match_chat(match_id))
    or (group_id is not null and (public.is_group_member(group_id) or public.my_role() = 'admin'))));
create policy "post chat" on public.chat_messages for insert with check (
  auth.uid() = user_id and (
    (match_id is null and group_id is null)
    or (match_id is not null and public.can_use_match_chat(match_id))
    or (group_id is not null and (public.is_group_member(group_id) or public.my_role() = 'admin'))));
