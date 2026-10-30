-- Kickoff: user roles + chat. Run once in the Supabase SQL editor, after schema.sql.

-- ───────────── Roles ─────────────
-- admin       : manages roles, can cancel any game and remove any chat message
-- organizer   : can host games
-- participant : can join games and chat (default for new sign-ups)
alter table public.profiles
  add column role text not null default 'participant'
  check (role in ('admin','organizer','participant'));

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Players may edit their own profile, but never their own role.
-- auth.uid() is null in the SQL editor, so you can still promote the first admin there.
create or replace function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null
     and coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_role_change();

create or replace function public.set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.my_role(), '') <> 'admin' then raise exception 'Only admins can change roles'; end if;
  if p_user = auth.uid() then raise exception 'You can''t change your own role'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

-- Only organizers and admins can host.
drop policy "host creates" on public.matches;
create policy "organizers create" on public.matches for insert
  with check (auth.uid() = host_id and public.my_role() in ('organizer','admin'));

create policy "admins update matches" on public.matches for update using (public.my_role() = 'admin');
create policy "admins delete matches" on public.matches for delete using (public.my_role() = 'admin');

-- ───────────── Chat ─────────────
-- match_id null  → community chat, open to every signed-in user
-- match_id set   → game chat, open to the host, anyone who joined (incl. waitlist) and admins
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index chat_messages_room_idx on public.chat_messages (match_id, created_at desc);

create or replace function public.can_use_match_chat(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin'
      or exists (select 1 from public.matches where id = p_match and host_id = auth.uid())
      or exists (select 1 from public.rsvps where match_id = p_match and user_id = auth.uid());
$$;

alter table public.chat_messages enable row level security;

create policy "read chat" on public.chat_messages for select
  using (auth.role() = 'authenticated' and (match_id is null or public.can_use_match_chat(match_id)));
create policy "post chat" on public.chat_messages for insert
  with check (auth.uid() = user_id and (match_id is null or public.can_use_match_chat(match_id)));
create policy "delete own or as admin" on public.chat_messages for delete
  using (auth.uid() = user_id or public.my_role() = 'admin');

alter publication supabase_realtime add table public.chat_messages;
