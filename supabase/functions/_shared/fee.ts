// Kickoff's platform fee per paid spot: 5%, at least 50¢, never more than the price.
// It comes out of the organizer's share; the player pays the listed price.
// Keep in sync with lib/fee.ts, which shows organizers their take-home.
export function platformFeeCents(priceCents: number) {
  if (priceCents <= 0) return 0;
  return Math.min(priceCents, Math.max(50, Math.round(priceCents * 0.05)));
}
