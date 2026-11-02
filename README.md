# Kickoff: pickup soccer for iPhone and Android

One React Native (Expo) codebase. Backend on Supabase. Payments through Stripe (cards, Apple Pay, Google Pay), paid out to each game's organizer with Stripe Connect.

## What's in it

| Feature | Where |
|---|---|
| Sign up with Apple, Google, or email + password | `app/(auth)/*`, `lib/auth.tsx` |
| Games feed (soonest first, distance shown), live spot counts | `app/(tabs)/index.tsx` |
| Map of nearby games | `app/(tabs)/map.tsx` |
| Host a game: venue search or drop-a-pin, date/time, **min and max players**, free or paid | `app/(tabs)/create.tsx`, `app/pick-location.tsx` |
| Join, leave, **waitlist**, auto-promotion when a spot opens | `supabase/schema.sql` (`join_match`, `leave_match`) |
| Voting on time or place, live tallies, one vote per player (re-vote allowed) | `app/match/[id]/index.tsx`, `new-poll.tsx` |
| Groups: anyone can start one and becomes its organizer. Join by invite or by request + organizer approval. Groups can have several organizers | `supabase/003_groups.sql`, `app/(tabs)/groups.tsx`, `app/group/*` |
| Games are posted by a group's organizers, either open to everyone or members only | `app/create.tsx` |
| App-wide admins moderate: cancel any game, delete any message, manage users | `app/admin.tsx` |
| Chat: community (everyone), per group (members), per game (host and players) | `components/ChatRoom.tsx`, `app/(tabs)/chat.tsx` |
| Store requirements: delete account (Me tab), report and block in chat, admin Reports screen, Sign in with Apple, links to the `site/` legal pages (`EXPO_PUBLIC_SITE_URL`) | `supabase/006_safety.sql`, `supabase/functions/delete-account`, `lib/safety.ts`, `app/reports.tsx`, `app/blocked.tsx`, `site/` |
| Paid games, two ways: **in the app** (card/Apple Pay/Google Pay, charged on the host's own Stripe account, so Stripe's fee is theirs and the platform pays no Connect fees) or **pay the organizer directly** (Venmo/Zelle/cash; organizers mark players paid) | `supabase/004_payouts.sql`, `supabase/005_payment_options.sql`, `supabase/functions/stripe-*`, `app/create.tsx` |
| Paid games: 15 minute spot hold, checkout, server-confirmed payment | `app/match/[id]/checkout.tsx`, `supabase/functions/*` |

### How the player limits work
- **Max** is enforced in the database (`join_match` locks the match row), so two people can't take the last spot at once. Extra sign-ups become a waitlist.
- **Min** decides the status shown everywhere: "Needs 3 more to confirm" until enough players have joined, then "Confirmed".
- The host can't lower the max below the number already going (`guard_player_limits` trigger).
- Min must be 2 or more and never above max; the form keeps the two steppers consistent.

## Setup

1. **Supabase**: create a project, run `supabase/schema.sql`, `supabase/002_roles_and_chat.sql` and `supabase/003_groups.sql`, `supabase/004_payouts.sql`, `supabase/005_payment_options.sql` and `supabase/006_safety.sql` in that order in the SQL editor. Everyone starts as a regular user; make yourself the first admin in the SQL editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
   After that, admins manage others from **Me → Manage users**. Group organizers are set inside each group, not here. Under Authentication → Providers enable Google and Apple, and add `kickoff://auth-callback` to the redirect URLs.
2. **Keys**: copy `.env.example` to `.env` and fill it in. Put Google Maps keys in `app.json` (`ios.config.googleMapsApiKey`, `android.config.googleMaps.apiKey`). Enable "Maps SDK" and "Places API (New)" in Google Cloud.
3. **Edge functions** (Supabase CLI):
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_PUBLISHABLE_KEY=pk_test_... STRIPE_CONNECT_WEBHOOK_SECRET=whsec_... \
     BRAINTREE_ENV=sandbox BRAINTREE_MERCHANT_ID=... BRAINTREE_PUBLIC_KEY=... BRAINTREE_PRIVATE_KEY=... BRAINTREE_VENMO_PROFILE_ID=...
   supabase functions deploy stripe-payment-sheet stripe-payment-confirm stripe-connect delete-account venmo-token venmo-checkout
   supabase functions deploy stripe-webhook stripe-connect-return --no-verify-jwt
   ```
   **Stripe Connect:** in the Stripe dashboard open **Connect** and finish the platform setup. Organizers get their own full Stripe account and pay Stripe's fees from it ("Stripe handles pricing"), so the platform pays no Connect fees.

   **Webhook:** add a webhook endpoint pointing at the `stripe-webhook` URL, set to listen to events on **Connected accounts**, for `payment_intent.succeeded`, `payment_intent.payment_failed` and `account.updated`. Its signing secret is `STRIPE_CONNECT_WEBHOOK_SECRET`.

   **Platform fee:** Kickoff keeps 5% (min 50¢) of each in-app payment as a Stripe application fee, taken from the organizer's share. Change it in both `supabase/functions/_shared/fee.ts` and `lib/fee.ts`.
4. **Run**: `npm install`, then `npx expo run:ios` or `npx expo run:android`. Stripe and maps need a development build, so **Expo Go will not work**.

## Things you still need to do

- **Venmo** (hidden: `VENMO_ENABLED` in `app/match/[id]/checkout.tsx`): Braintree pays into the platform's account, not the organizer's, so it doesn't fit the payout model as is. Stripe doesn't offer Venmo, so it goes through Braintree. Braintree has no maintained Expo package, so `getVenmoNonce()` in `lib/payments.ts` is a stub that throws a clear message. Connect it to a native Braintree module (or a WebView running Braintree's Venmo JS component). The server side (`venmo-token`, `venmo-checkout`) is written.
- **Sign in with Apple**: Apple's App Store rules require it on iOS when you offer Google sign-in. Already added.
- **Refunds**: leaving or being removed from a paid game doesn't refund automatically. For in-app payments organizers refund from their own Stripe dashboard (the money comes from their balance); for direct payments they refund the player themselves.
- **Expired holds**: an unpaid hold stops counting after 15 minutes. A scheduled job to delete old `pending_payment` rows and promote the waitlist would tidy this further.
- Bundle ID and Android package: `com.akbar.soccer`; Apple Pay merchant ID: `merchant.com.akbar.soccer` (register both in the Apple Developer portal). Replace the placeholder icon/splash.

## Not yet tested

Typechecks cleanly (`npx tsc --noEmit`) and the Expo config validates, but the app hasn't been run on a simulator or device, and the SQL and edge functions haven't been run against a live Supabase, Stripe, or Braintree account. Expect a round of small fixes on first run.
