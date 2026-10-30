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

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithProvider, signInWithApple } = useAuth();
  const [busy, setBusy] = useState<"apple" | "google" | "facebook" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const social = async (p: "apple" | "google" | "facebook") => {
    if (busy) return;
    setBusy(p);
    try { await (p === "apple" ? signInWithApple() : signInWithProvider(p)); }
    catch (e: any) { Alert.alert("Sign-in failed", e?.message ?? "Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <Screen style={{ paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.lg }}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={{
          width: 72, height: 72, borderRadius: 22, backgroundColor: colors.accent,
          alignItems: "center", justifyContent: "center", marginBottom: space.lg,
        }}>
          <Ionicons name="football" size={40} color={colors.accentInk} />
        </View>
        <Text style={type.display}>Kickoff</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: space.sm, fontSize: 18, lineHeight: 26 }]}>
          Find pickup soccer nearby. Set the time, lock the squad, play.
        </Text>
      </View>

      <View style={{ gap: space.sm + 4 }}>
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={27} style={{ height: 54 }} onPress={() => social("apple")} />
        )}
        <Button title="Continue with Google" icon="logo-google" variant="secondary"
          loading={busy === "google"} onPress={() => social("google")} />
        <Button title="Continue with Facebook" icon="logo-facebook" variant="secondary"
          loading={busy === "facebook"} onPress={() => social("facebook")} />
        <View style={{ flexDirection: "row", alignItems: "center", marginVertical: space.sm }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={[type.small, { marginHorizontal: space.md }]}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
        <Button title="Create account with email" onPress={() => router.push("/(auth)/sign-up")} />
        <Button title="I already have an account" variant="ghost" onPress={() => router.push("/(auth)/sign-in")} />
        <Text style={[type.small, { textAlign: "center", fontSize: 12 }]}>
          By continuing, you agree to our{" "}
          <Text style={{ color: colors.text, textDecorationLine: "underline" }} onPress={() => openLegal("terms")}>Terms</Text>
          {" "}and{" "}
          <Text style={{ color: colors.text, textDecorationLine: "underline" }} onPress={() => openLegal("privacy")}>Privacy Policy</Text>.
        </Text>
      </View>
    </Screen>
  );
}
