// Stripe's onboarding link must return to a web URL. This one just hands control back to the app,
// which then asks stripe-connect for the account's status. Deploy with --no-verify-jwt.
Deno.serve(() => new Response(null, { status: 302, headers: { Location: "kickoff://payouts-return" } }));
