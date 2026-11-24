-- Kickoff: push notifications. Run once in the Supabase SQL editor, after 008_nearby.sql.
--
-- Phones register an Expo push token after sign-in. Triggers on new group games and on chat
-- messages pick who should hear about it and hand the messages to Expo's push service
-- (https://exp.host), which delivers them through Apple (APNs) and Google (FCM).
-- pg_net sends the request after the insert commits, so a slow or failed push never blocks a post.
--
-- Who gets what:
--   new game in a group → its active members, except the host
--   group chat message  → its active members, except the sender
--   game chat message   → the host and everyone who joined (incl. waitlist), except the sender
-- Skipped: people who turned that kind off, muted the group, or blocked the sender or host.
-- Chat pings are throttled to one per chat per person every 2 minutes, so a busy chat doesn't buzz nonstop.

create extension if not exists pg_net;

-- ───────────── Device tokens ─────────────
-- A phone has one token; whoever signed in last on it owns it. lang picks the notification language.
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lang text not null default 'en',
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
-- no policies: only the two functions below touch it

create or replace function public.register_push_token(p_token text, p_lang text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then raise exception 'Not an Expo push token'; end if;
  insert into public.push_tokens (token, user_id, lang) values (p_token, auth.uid(), coalesce(p_lang, 'en'))
  on conflict (token) do update set user_id = excluded.user_id, lang = excluded.lang, updated_at = now();
end $$;

create or replace function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

-- ───────────── Preferences ─────────────
-- No row = everything on.
create table public.notification_settings (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  new_games boolean not null default true,
  group_chat boolean not null default true,
  game_chat boolean not null default true
);
alter table public.notification_settings enable row level security;
create policy "own notification settings" on public.notification_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A muted group sends you nothing: no new-game alerts, no chat.
create table public.group_mutes (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (user_id, group_id)
);
alter table public.group_mutes enable row level security;
create policy "own group mutes" on public.group_mutes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Last chat ping per person per room, for the 2-minute throttle.
create table public.push_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  room uuid not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, room)
);
alter table public.push_log enable row level security;

-- ───────────── Sending ─────────────
-- p_title: {lang: text}, falling back to 'en'. p_room set = chat message, throttled per room.
create or replace function public.push_to(p_users uuid[], p_title jsonb, p_body text, p_data jsonb, p_room uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  batch jsonb;
begin
  if p_room is not null then
    p_users := array(select u from unnest(p_users) u where not exists (
      select 1 from public.push_log l where l.user_id = u and l.room = p_room and l.sent_at > now() - interval '2 minutes'));
    insert into public.push_log (user_id, room)
    select u, p_room from unnest(p_users) u where exists (select 1 from public.push_tokens t where t.user_id = u)
    on conflict (user_id, room) do update set sent_at = now();
  end if;

  -- Expo takes up to 100 messages per request
  for batch in
    select jsonb_agg(jsonb_build_object(
             'to', token, 'title', coalesce(p_title ->> lang, p_title ->> 'en'), 'body', p_body,
             'data', p_data, 'sound', 'default', 'channelId', 'default', 'priority', 'high'))
    from (select token, lang, (row_number() over () - 1) / 100 as chunk
          from public.push_tokens where user_id = any(p_users)) t
    group by chunk
  loop
    perform net.http_post(url := 'https://exp.host/--/api/v2/push/send', body := batch,
                          headers := '{"Content-Type": "application/json", "Accept": "application/json"}');
  end loop;
exception when others then
  raise warning 'push_to failed: %', sqlerrm;   -- never let a notification break the post itself
end $$;
revoke execute on function public.push_to(uuid[], jsonb, text, jsonb, uuid) from public, anon, authenticated;

-- ───────────── New game in a group ─────────────
create or replace function public.notify_group_game() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g text;
begin
  select name into g from public.groups where id = new.group_id;
  perform public.push_to(
    array(select m.user_id from public.group_members m
          where m.group_id = new.group_id and m.status = 'active' and m.user_id <> new.host_id
            and coalesce((select s.new_games from public.notification_settings s where s.user_id = m.user_id), true)
            and not exists (select 1 from public.group_mutes x where x.user_id = m.user_id and x.group_id = new.group_id)
            and not exists (select 1 from public.blocks b where b.blocker_id = m.user_id and b.blocked_id = new.host_id)),
    jsonb_build_object(
      'en', 'New game in ' || g,
      'es', 'Nuevo partido en ' || g,
      'ru', 'Новая игра: ' || g,
      'uz', g || ': yangi oʻyin',
      'ko', g || ' 새 경기',
      'zh', g || ' 有新比赛'),
    new.title || ' · ' || new.venue_name,
    jsonb_build_object('url', '/match/' || new.id));
  return new;
exception when others then
  raise warning 'notify_group_game failed: %', sqlerrm;
  return new;
end $$;
create trigger matches_notify_group after insert on public.matches
  for each row when (new.group_id is not null and new.status = 'open') execute function public.notify_group_game();

-- ───────────── Chat messages ─────────────
create or replace function public.notify_chat_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  room_title text;
  sender text;
  url text;
  users uuid[];
begin
  select display_name into sender from public.profiles where id = new.user_id;

  if new.group_id is not null then
    select name into room_title from public.groups where id = new.group_id;
    url := '/group/' || new.group_id || '/chat';
    users := array(select m.user_id from public.group_members m
                   where m.group_id = new.group_id and m.status = 'active'
                     and coalesce((select s.group_chat from public.notification_settings s where s.user_id = m.user_id), true)
                     and not exists (select 1 from public.group_mutes x where x.user_id = m.user_id and x.group_id = new.group_id));
  elsif new.match_id is not null then
    select title into room_title from public.matches where id = new.match_id;
    url := '/match/' || new.match_id || '/chat';
    users := array(select u from (select user_id u from public.rsvps where match_id = new.match_id
                                  union select host_id from public.matches where id = new.match_id) p
                   where coalesce((select s.game_chat from public.notification_settings s where s.user_id = p.u), true));
  else
    return new;   -- community chat stays quiet
  end if;

  users := array(select u from unnest(users) u
                 where u <> new.user_id
                   and not exists (select 1 from public.blocks b where b.blocker_id = u and b.blocked_id = new.user_id));
  perform public.push_to(users, jsonb_build_object('en', room_title),
                         sender || ': ' || left(new.body, 180), jsonb_build_object('url', url),
                         coalesce(new.group_id, new.match_id));
  return new;
exception when others then
  raise warning 'notify_chat_message failed: %', sqlerrm;
  return new;
end $$;
create trigger chat_messages_notify after insert on public.chat_messages
  for each row execute function public.notify_chat_message();

-- ───────────── Cleanup ─────────────
-- Expo answers "DeviceNotRegistered" for apps that were uninstalled; drop those tokens hourly.
-- pg_net keeps responses for about 6 hours.
select cron.schedule('push-token-cleanup', '17 * * * *', $job$
  delete from public.push_tokens where token in (
    select e -> 'details' ->> 'expoPushToken'
    from net._http_response r,
         -- nested case so non-JSON bodies (error pages) are never cast
         jsonb_array_elements(case when r.content like '{%' then
                                case when jsonb_typeof(r.content::jsonb -> 'data') = 'array' then r.content::jsonb -> 'data' end
                              end) e
    where e -> 'details' ->> 'error' = 'DeviceNotRegistered')
$job$);
