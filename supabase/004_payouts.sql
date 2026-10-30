-- Kickoff: organizer payouts through Stripe Connect. Run once in the Supabase SQL editor, after 003_groups.sql.
--
-- Each organizer who charges for games links their own Stripe Express account. Players' payments for a
-- game go to that game's host. Rows are written only by the edge functions (service role).

create table public.payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,   -- Stripe lets this account receive payments
  payouts_enabled boolean not null default false,   -- Stripe can send money to their bank / debit card
  updated_at timestamptz not null default now()
);

alter table public.payout_accounts enable row level security;
create policy "see own payout account" on public.payout_accounts for select using (auth.uid() = user_id);

-- Paid games need a host who can receive money.
create or replace function public.guard_paid_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.price_cents > 0
     and (tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents or new.host_id is distinct from old.host_id)
     and not exists (select 1 from public.payout_accounts where user_id = new.host_id and charges_enabled) then
    raise exception 'Set up payouts before posting a paid game';
  end if;
  return new;
end $$;
create trigger matches_guard_paid before insert or update on public.matches
  for each row execute function public.guard_paid_match();
