-- Kickoff: notifications for group membership. Run once in the Supabase SQL editor, after 009_push.sql.
--
--   invited          → the invitee:   "You're invited to {group}"
--   asks to join     → organizers:    "{name} wants to join {group}"
--   request approved → the player:    "You're in {group}"
--   invite accepted  → organizers:    "{name} joined {group}"
-- Organizers who muted the group, or blocked the player, don't get the organizer ones.
-- Uses push_to() from 009_push.sql; like the other triggers, a failure never blocks the change itself.

create or replace function public.notify_membership() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g text;
  who text;
  organizers uuid[];
begin
  select name into g from public.groups where id = new.group_id;
  select display_name into who from public.profiles where id = new.user_id;
  organizers := array(select m.user_id from public.group_members m
                      where m.group_id = new.group_id and m.status = 'active' and m.role = 'organizer'
                        and m.user_id <> new.user_id
                        and not exists (select 1 from public.group_mutes x where x.user_id = m.user_id and x.group_id = new.group_id)
                        and not exists (select 1 from public.blocks b where b.blocker_id = m.user_id and b.blocked_id = new.user_id));

  if tg_op = 'INSERT' and new.status = 'invited' then
    perform public.push_to(array[new.user_id],
      jsonb_build_object(
        'en', 'You''re invited to ' || g,
        'es', 'Te invitaron a ' || g,
        'ru', 'Вас пригласили в группу «' || g || '»',
        'uz', 'Sizni «' || g || '» guruhiga taklif qilishdi',
        'ko', g || '에 초대되었습니다',
        'zh', '你受邀加入 ' || g),
      '', jsonb_build_object('url', '/group/' || new.group_id));

  elsif tg_op = 'INSERT' and new.status = 'pending' then
    perform public.push_to(organizers,
      jsonb_build_object(
        'en', who || ' wants to join ' || g,
        'es', who || ' quiere unirse a ' || g,
        'ru', who || ' хочет вступить в группу «' || g || '»',
        'uz', who || ' «' || g || '» guruhiga qoʻshilmoqchi',
        'ko', who || '님이 ' || g || ' 가입을 요청했습니다',
        'zh', who || ' 申请加入 ' || g),
      '', jsonb_build_object('url', '/group/' || new.group_id || '/members'));

  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.push_to(array[new.user_id],
      jsonb_build_object(
        'en', 'You''re in ' || g,
        'es', 'Ya eres parte de ' || g,
        'ru', 'Вы в группе «' || g || '»',
        'uz', 'Siz «' || g || '» guruhidasiz',
        'ko', g || ' 가입이 승인되었습니다',
        'zh', '你已加入 ' || g),
      '', jsonb_build_object('url', '/group/' || new.group_id));

  elsif tg_op = 'UPDATE' and old.status = 'invited' and new.status = 'active' then
    perform public.push_to(organizers,
      jsonb_build_object(
        'en', who || ' joined ' || g,
        'es', who || ' se unió a ' || g,
        'ru', who || ' вступил(а) в группу «' || g || '»',
        'uz', who || ' «' || g || '» guruhiga qoʻshildi',
        'ko', who || '님이 ' || g || '에 가입했습니다',
        'zh', who || ' 加入了 ' || g),
      '', jsonb_build_object('url', '/group/' || new.group_id || '/members'));
  end if;
  return new;
exception when others then
  raise warning 'notify_membership failed: %', sqlerrm;
  return new;
end $$;

create trigger group_members_notify after insert or update of status on public.group_members
  for each row execute function public.notify_membership();
