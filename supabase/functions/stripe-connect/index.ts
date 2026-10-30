// Organizer payouts through Stripe Connect.
// Organizers get their own full Stripe account and pay Stripe's fees themselves, so the platform pays
// no Connect fees. They manage payouts, bank details and refunds at dashboard.stripe.com.
//   { action: "onboard" } → creates the organizer's account once, returns a Stripe-hosted setup link
//   { action: "status" }  → re-reads the account from Stripe, stores and returns its status
import Stripe from "npm:stripe@17";
import { adminClient, cors, json, userClient } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });

// Stripe requires new platforms to create connected accounts with Accounts v2, which stripe-node v17
// doesn't cover, so those two calls go straight to the API. v2 accounts still work with the v1 APIs used
// elsewhere (reading status, direct charges with the Stripe-Account header).
const STRIPE_V2_VERSION = "2026-09-30.endive";

async function stripeV2<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v2/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
      "Stripe-Version": STRIPE_V2_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data as T;
}

async function sync(userId: string, accountId: string) {
  const a = await stripe.accounts.retrieve(accountId);
  const status = {
    details_submitted: a.details_submitted, charges_enabled: a.charges_enabled, payouts_enabled: a.payouts_enabled,
  };
  await adminClient().from("payout_accounts").update({ ...status, updated_at: new Date().toISOString() }).eq("user_id", userId);
  return status;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { data: { user } } = await userClient(req).auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);
    const { action } = await req.json();
    const db = adminClient();
    const { data: row } = await db.from("payout_accounts").select("stripe_account_id").eq("user_id", user.id).maybeSingle();
    let accountId = row?.stripe_account_id as string | undefined;

    if (action === "onboard") {
      if (!accountId) {
        const account = await stripeV2<{ id: string }>("core/accounts", {
          contact_email: user.email,
          display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email,
          dashboard: "full",
          identity: { country: "us", entity_type: "individual" },
          configuration: {
            merchant: { mcc: "7941", capabilities: { card_payments: { requested: true } } },
          },
          defaults: {
            currency: "usd",
            // Stripe bills its fees to the organizer and covers losses, so the platform pays no Connect fees
            responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
          },
          metadata: { user_id: user.id },
        });
        accountId = account.id;
        const { error } = await db.from("payout_accounts").insert({ user_id: user.id, stripe_account_id: accountId });
        if (error) throw new Error(error.message);
      }
      // Stripe only redirects to web URLs; this function bounces back into the app.
      const back = `${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-connect-return`;
      const link = await stripeV2<{ url: string }>("core/account_links", {
        account: accountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: { refresh_url: back, return_url: back },
        },
      });
      return json({ url: link.url });
    }

    if (!accountId) return json({ details_submitted: false, charges_enabled: false, payouts_enabled: false });
    if (action === "status") return json(await sync(user.id, accountId));
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
