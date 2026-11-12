import "react-native-url-polyfill/auto";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActionSheetHost } from "../components/ActionSheet";
import { AuthProvider, useAuth } from "../lib/auth";
import { colors } from "../lib/theme";
import { LanguageProvider, t } from "../lib/i18n";

// dark navigator background, so the space beside the content column on iPad matches the app
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.accent },
};

// routes that only close themselves; see app/auth-callback.tsx
const returnLinks: string[] = ["auth-callback", "payouts-return"];

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || returnLinks.includes(segments[0])) return;
    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) router.replace("/(auth)/welcome");
    else if (session && inAuth) router.replace("/(tabs)");
  }, [session, loading, segments]);



  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: "700" },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: "minimal",
      contentStyle: { backgroundColor: colors.bg },
    }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="match/[id]/index" options={{ title: "" }} />
      <Stack.Screen name="match/[id]/checkout" options={{ title: t("nav.checkout"), presentation: "modal" }} />
      <Stack.Screen name="match/[id]/chat" options={{ title: t("nav.gameChat") }} />
      <Stack.Screen name="community-chat" options={{ title: t("nav.community") }} />
      <Stack.Screen name="create" options={{ title: t("nav.postGame") }} />
      <Stack.Screen name="group/new" options={{ title: t("nav.newGroup"), presentation: "modal" }} />
      <Stack.Screen name="group/[id]/index" options={{ title: "" }} />
      <Stack.Screen name="group/[id]/members" options={{ title: t("nav.members") }} />
      <Stack.Screen name="group/[id]/chat" options={{ title: t("nav.groupChat") }} />
      <Stack.Screen name="admin" options={{ title: t("nav.users") }} />
      <Stack.Screen name="reports" options={{ title: t("nav.reports") }} />
      <Stack.Screen name="blocked" options={{ title: t("nav.blocked") }} />
      <Stack.Screen name="match/[id]/new-poll" options={{ title: t("nav.newVote"), presentation: "modal" }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: "none" }} />
      <Stack.Screen name="payouts-return" options={{ headerShown: false, animation: "none" }} />
      <Stack.Screen name="pick-location" options={{ title: t("nav.chooseLocation"), presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StripeProvider
          publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
          merchantIdentifier="merchant.com.akbar.soccer"
          urlScheme="kickoff"
        >
          <AuthProvider>
            <LanguageProvider>
              <ThemeProvider value={navTheme}>
                <StatusBar style="light" />
                <Gate />
                <ActionSheetHost />
              </ThemeProvider>
            </LanguageProvider>
          </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
