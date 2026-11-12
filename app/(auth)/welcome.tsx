import React, { useEffect, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { openLegal } from "../../lib/safety";
import { colors, space, type } from "../../lib/theme";
import { useLayout } from "../../lib/layout";
import { t } from "../../lib/i18n";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wide, landscape } = useLayout();
  const { signInWithProvider, signInWithApple } = useAuth();
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const social = async (p: "apple" | "google") => {
    if (busy) return;
    setBusy(p);
    try { await (p === "apple" ? signInWithApple() : signInWithProvider(p)); }
    catch (e: any) { Alert.alert(t("welcome.signInFailed"), e?.message ?? t("common.tryAgain")); }
    finally { setBusy(null); }
  };

  // Phones: brand on top, buttons at the bottom. iPad: both centred as one block, or side by side in landscape.
  const brand = (
    <View style={wide && !landscape ? { alignItems: "center" } : undefined}>
      <View style={{
        width: wide ? 96 : 72, height: wide ? 96 : 72, borderRadius: wide ? 28 : 22, backgroundColor: colors.accent,
        alignItems: "center", justifyContent: "center", marginBottom: space.lg,
      }}>
        <Ionicons name="football" size={wide ? 54 : 40} color={colors.accentInk} />
      </View>
      <Text style={[type.display, wide && { fontSize: 48, letterSpacing: -1.2 }]}>Kickoff</Text>
      <Text style={[type.body, { color: colors.muted, marginTop: space.sm, fontSize: wide ? 21 : 18, lineHeight: wide ? 30 : 26 },
        wide && !landscape && { textAlign: "center", maxWidth: 460 }]}>
        {t("welcome.tagline")}
      </Text>
    </View>
  );

  const actions = (
    <View style={{ gap: space.sm + 4 }}>
      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={27} style={{ height: 54 }} onPress={() => social("apple")} />
      )}
      <Button title={t("welcome.google")} icon="logo-google" variant="secondary"
        loading={busy === "google"} onPress={() => social("google")} />
      <View style={{ flexDirection: "row", alignItems: "center", marginVertical: space.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={[type.small, { marginHorizontal: space.md }]}>{t("welcome.or")}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      <Button title={t("welcome.createEmail")} onPress={() => router.push("/(auth)/sign-up")} />
      <Button title={t("welcome.haveAccount")} variant="ghost" onPress={() => router.push("/(auth)/sign-in")} />
      <Text style={[type.small, { textAlign: "center", fontSize: 12 }]}>
        {t("welcome.agreeStart")}
        <Text style={{ color: colors.text, textDecorationLine: "underline" }} onPress={() => openLegal("terms")}>{t("welcome.terms")}</Text>
        {t("welcome.and")}
        <Text style={{ color: colors.text, textDecorationLine: "underline" }} onPress={() => openLegal("privacy")}>{t("welcome.privacy")}</Text>
        {t("welcome.agreeEnd")}
      </Text>
    </View>
  );

  const pad = { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.lg };

  if (wide && landscape) {
    return (
      <Screen style={[pad, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 96 }]}>
        <View style={{ flex: 1, maxWidth: 440 }}>{brand}</View>
        <View style={{ flex: 1, maxWidth: 420 }}>{actions}</View>
      </Screen>
    );
  }

  if (wide) {
    return (
      <Screen style={[pad, { justifyContent: "center", alignItems: "center" }]}>
        <View style={{ width: "100%", maxWidth: 440, gap: 64 }}>
          {brand}
          {actions}
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={pad}>
      <View style={{ flex: 1, justifyContent: "center" }}>{brand}</View>
      {actions}
    </Screen>
  );
}
