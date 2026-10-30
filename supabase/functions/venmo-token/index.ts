// Venmo (US only) is offered through Braintree. Step 1: give the app a client token.
import braintree from "npm:braintree@3";
import { cors, json, userClient } from "../_shared/auth.ts";

export const gateway = new braintree.BraintreeGateway({
  environment: Deno.env.get("BRAINTREE_ENV") === "production"
    ? braintree.Environment.Production : braintree.Environment.Sandbox,
  merchantId: Deno.env.get("BRAINTREE_MERCHANT_ID")!,
  publicKey: Deno.env.get("BRAINTREE_PUBLIC_KEY")!,
  privateKey: Deno.env.get("BRAINTREE_PRIVATE_KEY")!,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const { data: { user } } = await userClient(req).auth.getUser();
  if (!user) return json({ error: "Not signed in" }, 401);
  const { clientToken } = await gateway.clientToken.generate({});
  return json({ clientToken });
});
