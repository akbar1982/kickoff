import { useCallback, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { callFunction, supabase } from "./supabase";


/** Cards + Apple Pay + Google Pay via Stripe PaymentSheet. */
export const getStripeSheetParams = (matchId: string) =>
  callFunction<{ paymentIntent: string; stripeAccountId: string; publishableKey: string }>(
    "stripe-payment-sheet", { matchId });

/** Asks the server to check the payment with Stripe and confirm the spot (doesn't wait for the webhook). */
export const confirmStripePayment = (matchId: string) =>
  callFunction<{ confirmed: boolean }>("stripe-payment-confirm", { matchId });

/** Venmo goes through Braintree. */
export const getVenmoClientToken = () => callFunction<{ clientToken: string }>("venmo-token", {});
export const submitVenmoPayment = (matchId: string, nonce: string) =>
  callFunction<{ ok: true }>("venmo-checkout", { matchId, nonce });

/**
 * Obtains a Venmo payment nonce from the Braintree native SDK.
 *
 * Braintree has no first-party Expo/React Native package, so this is the one
 * adapter you must connect to a native module of your choice (see README).
 * Until then it throws a clear error and the Venmo button reports it.
 */
export async function getVenmoNonce(_clientToken: string): Promise<string> {
  throw new Error("Venmo isn't connected yet. See README → Venmo.");
}

// ───────────── Organizer payouts (Stripe Connect) ─────────────

export interface PayoutStatus { details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean }

const connect = <T>(action: "onboard" | "status") => callFunction<T>("stripe-connect", { action });

/** The signed-in user's payout status. `ready` means they can post paid games. */
export function usePayouts() {
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // Read the stored copy first (instant), then ask Stripe for the latest.
  const refresh = useCallback(async () => {
    const { data } = await supabase.from("payout_accounts").select("details_submitted,charges_enabled,payouts_enabled").maybeSingle();
    setStatus(data ?? { details_submitted: false, charges_enabled: false, payouts_enabled: false });
    if (data) setStatus(await connect<PayoutStatus>("status").catch(() => data));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  /** Opens Stripe's setup pages; returns once the organizer comes back to the app. */
  const setUp = useCallback(async () => {
    setBusy(true);
    try {
      const { url } = await connect<{ url: string }>("onboard");
      await WebBrowser.openAuthSessionAsync(url, "kickoff://payouts-return");
      await refresh();
    } finally { setBusy(false); }
  }, [refresh]);

  // Organizers have their own full Stripe account: payouts, bank details and refunds live there.
  const openDashboard = useCallback(async () => {
    await WebBrowser.openBrowserAsync("https://dashboard.stripe.com");
  }, []);

  return { status, ready: !!status?.charges_enabled, busy, refresh, setUp, openDashboard };
}
