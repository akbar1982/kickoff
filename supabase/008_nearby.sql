-- Kickoff: groups get a location, so Discover can list the ones near you.
-- Run once in the Supabase SQL editor, after 007_past_games.sql.
--
-- The app saves a new group's area (rounded to ~1 km) when it's created. Groups without one
-- take the location of their games: existing groups now, others when their first game is posted.

alter table public.groups
  add column lat double precision,
  add column lng double precision;

update public.groups g set lat = m.lat, lng = m.lng
from (select distinct on (group_id) group_id, lat, lng
      from public.matches where group_id is not null
      order by group_id, starts_at desc) m
where m.group_id = g.id and g.lat is null;

create or replace function public.group_takes_game_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.groups set lat = round(new.lat::numeric, 2), lng = round(new.lng::numeric, 2)
  where id = new.group_id and lat is null;
  return new;
end $$;
create trigger matches_place_group after insert on public.matches
  for each row when (new.group_id is not null) execute function public.group_takes_game_location();

-- g.* was expanded when the view was made, so it has to be rebuilt to include lat/lng.
drop view public.group_overview;
create view public.group_overview with (security_invoker = true) as
select g.*,
  (select count(*) from public.group_members m where m.group_id = g.id and m.status = 'active')  as member_count,
  (select count(*) from public.group_members m where m.group_id = g.id and m.status = 'pending') as pending_count,
  me.status as my_status,
  me.role   as my_group_role
from public.groups g
left join public.group_members me on me.group_id = g.id and me.user_id = auth.uid();
