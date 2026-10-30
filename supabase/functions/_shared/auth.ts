import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Client acting as the caller (respects RLS). */
export function userClient(req: Request) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

/** Service-role client for trusted server work (never ship this key to the app). */
export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Loads the caller, the match, and verifies they hold an unexpired payment spot. */
export async function loadPayableMatch(req: Request, matchId: string) {
  const sb = userClient(req);
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: cors });

  const { data: rsvp } = await sb.from("rsvps").select("status, hold_expires_at")
    .eq("match_id", matchId).eq("user_id", user.id).maybeSingle();
  if (!rsvp || rsvp.status !== "pending_payment" || new Date(rsvp.hold_expires_at) < new Date()) {
    throw new Response(JSON.stringify({ error: "Your spot hold expired. Join again." }), { status: 409, headers: cors });
  }
  const { data: match } = await sb.from("matches").select("id, title, price_cents, currency, host_id").eq("id", matchId).single();
  if (!match || match.price_cents <= 0) {
    throw new Response(JSON.stringify({ error: "This match is free" }), { status: 400, headers: cors });
  }
  return { user, match };
}
