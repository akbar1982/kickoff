// Deletes an account and everything linked to it (required by the App Store and Google Play).
//   {}                 → deletes the caller's own account
//   { userId: "..." }  → admins only: removes another user (e.g. after a report)
// Deleting the auth user cascades to the profile, RSVPs, messages, memberships, hosted games and payment rows.
// An organizer's Stripe account belongs to them, so it is only unlinked, never closed.
import { adminClient, cors, json, userClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { data: { user } } = await userClient(req).auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);
    const { userId } = await req.json().catch(() => ({}));
    const db = adminClient();

    let target = user.id;
    if (userId && userId !== user.id) {
      const { data: me } = await db.from("profiles").select("role").eq("id", user.id).single();
      if (me?.role !== "admin") return json({ error: "Only admins can remove other users" }, 403);
      target = userId;
    }

    const { error: prepError } = await db.rpc("prepare_account_deletion", { p_user: target });
    if (prepError) return json({ error: prepError.message }, 409);
    const { error } = await db.auth.admin.deleteUser(target);
    if (error) throw new Error(error.message);
    return json({ deleted: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
