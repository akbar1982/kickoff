import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { confirmPlatformPayPayment, initStripe, isPlatformPaySupported, openPlatformPaySetup, PlatformPay, PlatformPayButton, useStripe } from "@stripe/stripe-react-native";
import { Button, Card, Chip } from "../../../components/ui";
import { supabase } from "../../../lib/supabase";
import { formatPrice, formatWhen } from "../../../lib/hooks";
import { confirmStripePayment, getStripeSheetParams, getVenmoClientToken, getVenmoNonce, submitVenmoPayment } from "../../../lib/payments";
import { colors, scheme, space, type } from "../../../lib/theme";
import { column, widths } from "../../../lib/layout";
import type { Match } from "../../../lib/types";
import { t } from "../../../lib/i18n";

// Venmo runs through Braintree, which pays into the platform's account rather than the organizer's,
// and its app-side module isn't connected yet (see README). Hidden until both are sorted out.
const VENMO_ENABLED = false;

export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [match, setMatch] = useState<Match | null>(null);
  const [busy, setBusy] = useState<"card" | "apple" | "venmo" | null>(null);
  // iOS: an Apple Pay button when Wallet has a card, otherwise Apple's "Set up Apple Pay" button
  const [applePay, setApplePay] = useState<boolean | null>(null);
  useEffect(() => { if (Platform.OS === "ios") isPlatformPaySupported().then(setApplePay).catch(() => setApplePay(false)); }, []);
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
      Alert.alert(t("checkout.released"), t("checkout.releasedBody"));
      router.back();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(timer);
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

  /** Creates the payment on the organizer's own Stripe account and returns its client secret. */
  const preparePayment = async () => {
    const p = await getStripeSheetParams(id);
    await initStripe({
      publishableKey: p.publishableKey,
      stripeAccountId: p.stripeAccountId,
      merchantIdentifier: "merchant.com.akbar.soccer",
      urlScheme: "kickoff",
    });
    return p.paymentIntent;
  };

  /** After a successful payment: confirm the spot, then close checkout. */
  const finishPayment = async () => {
    await confirmStripePayment(id).catch(() => null);   // the webhook confirms it too, as a backstop
    if (!(await waitForConfirmation())) Alert.alert(t("checkout.received"), t("checkout.receivedBody"));
    router.back();
  };

  const payWithApplePay = async () => {
    if (!match || busy) return;
    setBusy("apple");
    try {
      const clientSecret = await preparePayment();
      const { error } = await confirmPlatformPayPayment(clientSecret, {
        applePay: {
          merchantCountryCode: "US",
          currencyCode: match.currency.toUpperCase(),
          cartItems: [
            { paymentType: PlatformPay.PaymentType.Immediate, label: match.title, amount: (match.price_cents / 100).toFixed(2) },
            { paymentType: PlatformPay.PaymentType.Immediate, label: match.host_name || "Kickoff", amount: (match.price_cents / 100).toFixed(2) },
          ],
        },
      });
      if (error) {
        if (error.code !== "Canceled") Alert.alert(t("checkout.failed"), error.message);
        return;
      }
      await finishPayment();
    } catch (e: any) {
      Alert.alert(t("checkout.error"), e?.message ?? t("common.somethingWrongDot"));
    } finally { setBusy(null); }
  };

  const payWithCard = async () => {
    setBusy("card");
    try {
      const paymentIntent = await preparePayment();
      const init = await initPaymentSheet({
        merchantDisplayName: match?.host_name ?? "Kickoff",
        paymentIntentClientSecret: paymentIntent,
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
        if (res.error.code !== "Canceled") Alert.alert(t("checkout.failed"), res.error.message);
        return;
      }
      await finishPayment();
    } catch (e: any) {
      Alert.alert(t("checkout.error"), e?.message ?? t("common.somethingWrongDot"));
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
      Alert.alert("Venmo", e?.message ?? t("common.somethingWrongDot"));
    } finally { setBusy(null); }
  };

  if (!match) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const ss = secondsLeft !== null ? String(secondsLeft % 60).padStart(2, "0") : null;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[{ padding: space.md }, column(widths.form)]}>
      <Card>
        <Text style={type.small}>{formatWhen(match.starts_at)}</Text>
        <Text style={[type.title, { marginTop: 2 }]}>{match.title}</Text>
        <Text style={[type.small, { marginTop: 2 }]}>{match.venue_name}</Text>
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={type.body}>{t("checkout.total")}</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{formatPrice(match.price_cents, match.currency)}</Text>
        </View>
      </Card>

      {mm !== null && (
        <View style={{ alignItems: "center", marginVertical: space.md }}>
          <Chip label={t("checkout.held", { time: `${mm}:${ss}` })} tone={secondsLeft! < 120 ? "warn" : "accent"} icon="time" />
        </View>
      )}

      <View style={{ gap: space.sm + 4, marginTop: space.md }}>
        {applePay === true && (
          <PlatformPayButton type={PlatformPay.ButtonType.Book} borderRadius={27} style={{ height: 54 }}
            appearance={scheme() === "light" ? PlatformPay.ButtonStyle.Black : PlatformPay.ButtonStyle.White}
            disabled={busy !== null} onPress={payWithApplePay} />
        )}
        {applePay === false && (
          <>
            <PlatformPayButton type={PlatformPay.ButtonType.SetUp} borderRadius={27} style={{ height: 54 }}
              appearance={scheme() === "light" ? PlatformPay.ButtonStyle.Black : PlatformPay.ButtonStyle.White}
              onPress={() => openPlatformPaySetup()} />
            <Text style={[type.small, { textAlign: "center" }]}>{t("checkout.applePaySetup")}</Text>
          </>
        )}
        <Button
          title={t(Platform.OS === "ios" ? "checkout.payCard" : "checkout.payGoogle")}
          variant={Platform.OS === "ios" ? "secondary" : undefined}
          icon="card" onPress={payWithCard} loading={busy === "card"} disabled={busy === "venmo" || busy === "apple"} />
        {VENMO_ENABLED && (
          <Button title={t("checkout.payVenmo")} variant="secondary" onPress={payWithVenmo}
            loading={busy === "venmo"} disabled={busy === "card"} />
        )}
      </View>

      <Text style={[type.small, { textAlign: "center", marginTop: space.lg }]}>
        {t("checkout.cards")}
      </Text>
    </ScrollView>
  );
}
