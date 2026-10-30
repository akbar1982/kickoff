// Stripe is the source of truth: the spot is only confirmed when this webhook
// receives payment_intent.succeeded, never because the app says it paid.
//
// Payments are made on organizers' connected accounts, so their events arrive on a Connect webhook
// endpoint (STRIPE_CONNECT_WEBHOOK_SECRET). Events on the platform account itself are accepted too
// (STRIPE_WEBHOOK_SECRET). Deploy with --no-verify-jwt.
import Stripe from "npm:stripe@17";
import { adminClient } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });
// Edge runtimes verify signatures with Web Crypto, not Node's crypto module.
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const secrets = [Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET"), Deno.env.get("STRIPE_WEBHOOK_SECRET")].filter(Boolean) as string[];

async function verify(body: string, sig: string) {
  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider);
    } catch (e) {
      console.error("signature check failed:", (e as Error).message);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const body = await req.text();
  const event = await verify(body, req.headers.get("stripe-signature") ?? "");
  if (!event) return new Response("Bad signature", { status: 400 });
  console.log("stripe event:", event.type, event.id);

  const db = adminClient();
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    // Only payments made from the app carry a match and player; ignore anything else (e.g. `stripe trigger`).
    if (!pi.metadata?.match_id || !pi.metadata?.user_id) return new Response("ok (not a Kickoff payment)");
    await db.from("payments").update({ status: "succeeded" })
      .eq("provider", "stripe").eq("provider_ref", pi.id);
    const { error } = await db.rpc("mark_rsvp_paid", { p_match: pi.metadata.match_id, p_user: pi.metadata.user_id });
    if (error) {
      console.error("mark_rsvp_paid failed:", error.message);
      return new Response(error.message, { status: 500 });   // Stripe retries on non-2xx
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await db.from("payments").update({ status: "failed" })
      .eq("provider", "stripe").eq("provider_ref", pi.id);
  } else if (event.type === "account.updated") {
    // keeps an organizer's payout status current without them reopening the app
    const a = event.data.object as Stripe.Account;
    await db.from("payout_accounts").update({
      details_submitted: a.details_submitted, charges_enabled: a.charges_enabled,
      payouts_enabled: a.payouts_enabled, updated_at: new Date().toISOString(),
    }).eq("stripe_account_id", a.id);
  }
  return new Response("ok");
});
