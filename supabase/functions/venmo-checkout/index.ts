// Venmo step 2: the app sends the payment-method nonce it got from Venmo.
// The amount is read from the database, never trusted from the client.
import braintree from "npm:braintree@3";
import { adminClient, cors, json, loadPayableMatch } from "../_shared/auth.ts";

const gateway = new braintree.BraintreeGateway({
  environment: Deno.env.get("BRAINTREE_ENV") === "production"
    ? braintree.Environment.Production : braintree.Environment.Sandbox,
  merchantId: Deno.env.get("BRAINTREE_MERCHANT_ID")!,
  publicKey: Deno.env.get("BRAINTREE_PUBLIC_KEY")!,
  privateKey: Deno.env.get("BRAINTREE_PRIVATE_KEY")!,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { matchId, nonce } = await req.json();
    const { user, match } = await loadPayableMatch(req, matchId);

    const result = await gateway.transaction.sale({
      amount: (match.price_cents / 100).toFixed(2),
      paymentMethodNonce: nonce,
      options: { submitForSettlement: true, venmo: { profileId: Deno.env.get("BRAINTREE_VENMO_PROFILE_ID") } },
      customFields: { match_id: match.id, user_id: user.id },
    });

    const db = adminClient();
    await db.from("payments").insert({
      match_id: match.id, user_id: user.id, provider: "venmo",
      provider_ref: result.transaction?.id ?? crypto.randomUUID(),
      amount_cents: match.price_cents, currency: match.currency,
      status: result.success ? "succeeded" : "failed",
    });
    if (!result.success) return json({ error: result.message }, 402);

    await db.rpc("mark_rsvp_paid", { p_match: match.id, p_user: user.id });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 500);
  }
});
