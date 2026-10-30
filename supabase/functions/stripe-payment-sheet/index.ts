// Creates a Stripe PaymentIntent for a held spot and returns what the app's PaymentSheet needs.
// Cards (Visa, Mastercard, Amex...), Apple Pay and Google Pay are all handled by the PaymentSheet.
//
// This is a direct charge: the payment is made on the host's own Stripe account, Stripe takes its fee
// from them, and the rest is theirs. The platform can optionally keep PLATFORM_FEE_PERCENT on top.
import Stripe from "npm:stripe@17";
import { adminClient, cors, json, loadPayableMatch } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { matchId } = await req.json();
    const { user, match } = await loadPayableMatch(req, matchId);

    const { data: payout } = await adminClient().from("payout_accounts")
      .select("stripe_account_id").eq("user_id", match.host_id).maybeSingle();
    const account = payout?.stripe_account_id;
    if (!account || !(await stripe.accounts.retrieve(account)).charges_enabled) {
      return json({ error: "This game's organizer hasn't finished setting up payouts yet." }, 409);
    }

    const platformCut = Math.round(match.price_cents * Number(Deno.env.get("PLATFORM_FEE_PERCENT") ?? 0) / 100);
    const intent = await stripe.paymentIntents.create({
      amount: match.price_cents,
      currency: match.currency,
      automatic_payment_methods: { enabled: true },
      description: `Kickoff: ${match.title}`,
      metadata: { match_id: match.id, user_id: user.id },
      ...(platformCut > 0 ? { application_fee_amount: platformCut } : {}),
    }, { stripeAccount: account });

    await adminClient().from("payments").insert({
      match_id: match.id, user_id: user.id, provider: "stripe", provider_ref: intent.id,
      amount_cents: match.price_cents, currency: match.currency, status: "pending",
    });

    return json({
      paymentIntent: intent.client_secret,
      stripeAccountId: account,
      publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY"),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 500);
  }
});
