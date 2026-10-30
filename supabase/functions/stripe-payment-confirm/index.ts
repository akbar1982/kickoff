// Called by the app right after the payment sheet reports success. Asks Stripe directly whether the
// player's payment went through and, if so, confirms their spot. Players aren't left waiting on the
// webhook; the webhook stays as the backstop for payments that finish after the app is closed.
// Nothing from the app is trusted except which match to check.
import Stripe from "npm:stripe@17";
import { adminClient, cors, json, userClient } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { data: { user } } = await userClient(req).auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);
    const { matchId } = await req.json();

    const db = adminClient();
    const { data: match } = await db.from("matches").select("host_id").eq("id", matchId).single();
    const { data: payout } = await db.from("payout_accounts")
      .select("stripe_account_id").eq("user_id", match?.host_id ?? "").maybeSingle();
    if (!payout) return json({ confirmed: false });

    // Most recent attempts first; a player may have opened the payment sheet more than once.
    const { data: attempts } = await db.from("payments").select("provider_ref")
      .eq("match_id", matchId).eq("user_id", user.id).eq("provider", "stripe").eq("status", "pending")
      .order("created_at", { ascending: false }).limit(5);

    for (const { provider_ref } of attempts ?? []) {
      const pi = await stripe.paymentIntents.retrieve(provider_ref, { stripeAccount: payout.stripe_account_id });
      if (pi.status !== "succeeded" || pi.metadata.user_id !== user.id || pi.metadata.match_id !== matchId) continue;
      await db.from("payments").update({ status: "succeeded" }).eq("provider", "stripe").eq("provider_ref", pi.id);
      const { error } = await db.rpc("mark_rsvp_paid", { p_match: matchId, p_user: user.id });
      if (error) throw new Error(error.message);
      return json({ confirmed: true });
    }
    return json({ confirmed: false });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
