import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { initStripe, useStripe } from "@stripe/stripe-react-native";
import { Button, Card, Chip } from "../../../components/ui";
import { supabase } from "../../../lib/supabase";
import { formatPrice, formatWhen } from "../../../lib/hooks";
import { confirmStripePayment, getStripeSheetParams, getVenmoClientToken, getVenmoNonce, submitVenmoPayment } from "../../../lib/payments";
import { colors, space, type } from "../../../lib/theme";
import type { Match } from "../../../lib/types";

// Venmo runs through Braintree, which pays into the platform's account rather than the organizer's,
// and its app-side module isn't connected yet (see README). Hidden until both are sorted out.
const VENMO_ENABLED = false;

export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [match, setMatch] = useState<Match | null>(null);
  const [busy, setBusy] = useState<"card" | "venmo" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: u }] = await Promise.all([
        supabase.from("match_overview").select("*").eq("id", id).single(),
        supabase.auth.getUser(),
      ]);
      setMatch(m as Match);
      const { data: r } = await supabase.from("rsvps").select("hold_expires_at,status")
        .eq("match_id", id).eq("user_id", u.user?.id ?? "").maybeSingle();
      if (r?.status === "going") { router.back(); return; }
      if (r?.hold_expires_at) setSecondsLeft(Math.max(0, Math.round((+new Date(r.hold_expires_at) - Date.now()) / 1000)));
    })();
  }, [id]);

  // countdown for the 15 minute spot hold
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      Alert.alert("Spot released", "Your 15 minute hold ran out. Join again to get a new one.");
      router.back();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  /** Waits for the server to confirm the spot (set by Stripe's webhook, not by this device). */
  const waitForConfirmation = async () => {
    const { data: u } = await supabase.auth.getUser();
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase.from("rsvps").select("status")
        .eq("match_id", id).eq("user_id", u.user?.id ?? "").maybeSingle();
      if (data?.status === "going") return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  };

  const payWithCard = async () => {
    setBusy("card");
    try {
      const p = await getStripeSheetParams(id);
      // The payment is made on the organizer's own Stripe account.
      await initStripe({
        publishableKey: p.publishableKey,
        stripeAccountId: p.stripeAccountId,
        merchantIdentifier: "merchant.com.akbar.soccer",
        urlScheme: "kickoff",
      });
      const init = await initPaymentSheet({
        merchantDisplayName: match?.host_name ?? "Kickoff",
        paymentIntentClientSecret: p.paymentIntent,
        applePay: { merchantCountryCode: "US" },
        googlePay: { merchantCountryCode: "US", testEnv: __DEV__, currencyCode: (match?.currency ?? "usd").toUpperCase() },
        returnURL: "kickoff://stripe-redirect",
        allowsDelayedPaymentMethods: false,
        appearance: {
          colors: {
            primary: colors.accent, background: colors.surface, componentBackground: colors.surfaceHi,
            componentText: colors.text, primaryText: colors.text, secondaryText: colors.muted, placeholderText: colors.muted,
          },
        },
      });
      if (init.error) throw new Error(init.error.message);

      const res = await presentPaymentSheet();
      if (res.error) {
        if (res.error.code !== "Canceled") Alert.alert("Payment failed", res.error.message);
        return;
      }
      await confirmStripePayment(id).catch(() => null);   // the webhook confirms it too, as a backstop
      if (await waitForConfirmation()) {
        router.back();
      } else {
        Alert.alert("Payment received", "We're confirming your spot. It will show up on the game page in a moment.");
        router.back();
      }
    } catch (e: any) {
      Alert.alert("Payment error", e?.message ?? "Something went wrong.");
    } finally { setBusy(null); }
  };

  const payWithVenmo = async () => {
    setBusy("venmo");
    try {
      const { clientToken } = await getVenmoClientToken();
      const nonce = await getVenmoNonce(clientToken);
      await submitVenmoPayment(id, nonce);
      router.back();
    } catch (e: any) {
      Alert.alert("Venmo", e?.message ?? "Something went wrong.");
    } finally { setBusy(null); }
  };

  if (!match) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const ss = secondsLeft !== null ? String(secondsLeft % 60).padStart(2, "0") : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.md }}>
      <Card>
        <Text style={type.small}>{formatWhen(match.starts_at)}</Text>
        <Text style={[type.title, { marginTop: 2 }]}>{match.title}</Text>
        <Text style={[type.small, { marginTop: 2 }]}>{match.venue_name}</Text>
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={type.body}>Total</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{formatPrice(match.price_cents, match.currency)}</Text>
        </View>
      </Card>

      {mm !== null && (
        <View style={{ alignItems: "center", marginVertical: space.md }}>
          <Chip label={`Spot held for ${mm}:${ss}`} tone={secondsLeft! < 120 ? "warn" : "accent"} icon="time" />
        </View>
      )}

      <View style={{ gap: space.sm + 4, marginTop: space.md }}>
        <Button
          title={Platform.OS === "ios" ? "Pay with card or Apple Pay" : "Pay with card or Google Pay"}
          icon="card" onPress={payWithCard} loading={busy === "card"} disabled={busy === "venmo"} />
        {VENMO_ENABLED && (
          <Button title="Pay with Venmo" variant="secondary" onPress={payWithVenmo}
            loading={busy === "venmo"} disabled={busy === "card"} />
        )}
      </View>

      <Text style={[type.small, { textAlign: "center", marginTop: space.lg }]}>
        Visa, Mastercard, American Express and Discover accepted. Card details go straight to Stripe and never touch our servers.
      </Text>
    </ScrollView>
  );
}
