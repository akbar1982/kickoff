// Kickoff's platform fee per paid spot: 5%, at least 50¢, never more than the price.
// The server charges it (supabase/functions/_shared/fee.ts); keep the two in sync.
export function platformFeeCents(priceCents: number) {
  if (priceCents <= 0) return 0;
  return Math.min(priceCents, Math.max(50, Math.round(priceCents * 0.05)));
}

/** Stripe's US card fee, charged to the organizer's own Stripe account. */
export function stripeFeeCents(priceCents: number) {
  return Math.ceil(priceCents * 0.029) + 30;
}
