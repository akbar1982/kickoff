-- Kickoff: account deletion, reporting and blocking (App Store / Google Play requirements).
-- Run once in the Supabase SQL editor, after 005_payment_options.sql.

-- ───────────── Account deletion ─────────────
-- Deleting an account removes the auth user, which cascades to the profile and everything the user owns.
-- Groups and polls a user started outlive them, so their creator columns become nullable.
alter table public.groups alter column created_by drop not null,
  drop constraint groups_created_by_fkey,
  add constraint groups_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
alter table public.polls alter column created_by drop not null,
  drop constraint polls_created_by_fkey,
  add constraint polls_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

-- Called by the delete-account edge function just before the user is deleted.
--   * refuses while they host upcoming games that players have already paid for (refund those first)
--   * hands each group they're the last organizer of to its longest-standing member, or deletes it if empty
create or replace function public.prepare_account_deletion(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g uuid;
  heir uuid;
begin
  if exists (
    select 1 from public.matches m join public.rsvps r on r.match_id = m.id
     where m.host_id = p_user and m.status = 'open' and m.starts_at > now()
       and r.user_id <> p_user and r.paid_at is not null
  ) then
    raise exception 'You host upcoming games that players have paid for. Cancel them and refund the players first.';
  end if;

  for g in select group_id from public.group_members
            where user_id = p_user and role = 'organizer' and status = 'active' loop
    if not exists (select 1 from public.group_members
                    where group_id = g and user_id <> p_user and role = 'organizer' and status = 'active') then
      select user_id into heir from public.group_members
       where group_id = g and user_id <> p_user and status = 'active'
       order by created_at limit 1;
      if heir is null then
        delete from public.groups where id = g;
      else
        update public.group_members set role = 'organizer' where group_id = g and user_id = heir;
      end if;
    end if;
  end loop;
end $$;
revoke execute on function public.prepare_account_deletion(uuid) from public, anon, authenticated;

-- ───────────── Blocking ─────────────
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "own blocks" on public.blocks for all
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create or replace function public.i_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = p_user);
$$;

-- Messages from people you've blocked are hidden from you (realtime included).
drop policy "read chat" on public.chat_messages;
create policy "read chat" on public.chat_messages for select using (
  auth.role() = 'authenticated' and not public.i_blocked(user_id) and (
    (match_id is null and group_id is null)
    or (match_id is not null and public.can_use_match_chat(match_id))
    or (group_id is not null and (public.is_group_member(group_id) or public.my_role() = 'admin'))));

-- ───────────── Reports ─────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles(id) on delete set null,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete set null,
  message_body text,                  -- kept so admins can still see what was said after it's deleted
  reason text not null check (reason in ('harassment','hate','sexual','spam','other')),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);
create index reports_open_idx on public.reports (created_at) where status = 'open';
alter table public.reports enable row level security;
create policy "anyone reports" on public.reports for insert
  with check (auth.uid() = reporter_id and reported_user_id <> auth.uid());
create policy "admins read reports" on public.reports for select using (public.my_role() = 'admin');
create policy "admins resolve reports" on public.reports for update using (public.my_role() = 'admin');

-- A reported message's author and text come from the message itself, not from the reporter.
create or replace function public.fill_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.message_id is not null then
    select user_id, body into new.reported_user_id, new.message_body
      from public.chat_messages where id = new.message_id;
    if not found then raise exception 'Message not found'; end if;
  end if;
  return new;
end $$;
create trigger reports_fill before insert on public.reports
  for each row execute function public.fill_report();
