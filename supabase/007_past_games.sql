-- Kickoff: past games.
-- Run once in the Supabase SQL editor, after 006_safety.sql.
--
-- A game stays visible to everyone (shown greyed out in the app) for 1 day after it starts.
-- After that only its organizer sees it, and 30 days after it starts it is deleted for good,
-- together with its players, votes, chat and payment records (Stripe keeps its own copy).

drop policy "matches readable" on public.matches;
create policy "matches readable" on public.matches for select using (
  auth.role() = 'authenticated'
  and (starts_at > now() - interval '1 day' or host_id = auth.uid())
  and (visibility = 'public' or host_id = auth.uid() or public.is_group_member(group_id) or public.my_role() = 'admin'));

-- Nightly cleanup at 4:15 AM UTC.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('delete-old-games', '15 4 * * *',
  $$delete from public.matches where starts_at < now() - interval '30 days'$$);
