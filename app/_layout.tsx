import "react-native-url-polyfill/auto";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActionSheetHost } from "../components/ActionSheet";
import { AuthProvider, useAuth } from "../lib/auth";
import { colors } from "../lib/theme";

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
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
      contentStyle: { backgroundColor: colors.bg },
    }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="match/[id]/index" options={{ title: "" }} />
      <Stack.Screen name="match/[id]/checkout" options={{ title: "Checkout", presentation: "modal" }} />
      <Stack.Screen name="match/[id]/chat" options={{ title: "Game chat" }} />
      <Stack.Screen name="community-chat" options={{ title: "Community" }} />
      <Stack.Screen name="create" options={{ title: "Post a game" }} />
      <Stack.Screen name="group/new" options={{ title: "New group", presentation: "modal" }} />
      <Stack.Screen name="group/[id]/index" options={{ title: "" }} />
      <Stack.Screen name="group/[id]/members" options={{ title: "Members" }} />
      <Stack.Screen name="group/[id]/chat" options={{ title: "Group chat" }} />
      <Stack.Screen name="admin" options={{ title: "Users" }} />
      <Stack.Screen name="reports" options={{ title: "Reports" }} />
      <Stack.Screen name="blocked" options={{ title: "Blocked users" }} />
      <Stack.Screen name="match/[id]/new-poll" options={{ title: "New vote", presentation: "modal" }} />
      <Stack.Screen name="pick-location" options={{ title: "Choose location", presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider
          publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
          merchantIdentifier="merchant.com.akbar.soccer"
          urlScheme="kickoff"
        >
          <AuthProvider>
            <StatusBar style="light" />
            <Gate />
            <ActionSheetHost />
          </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
