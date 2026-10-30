import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Field, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { colors, space, type } from "../../lib/theme";

export default function SignIn() {
  const { signInWithEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.includes("@") || password.length < 6) {
      Alert.alert("Check your details", "Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try { await signInWithEmail(email, password); }
    catch (e: any) { Alert.alert("Couldn't sign in", e?.message ?? "Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
          <Text style={type.display}>Welcome back</Text>
          <Text style={[type.body, { color: colors.muted, marginBottom: space.xl, marginTop: space.sm }]}>
            Sign in to see games near you.
          </Text>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none"
            keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry
            autoComplete="password" placeholder="••••••••" />
          <Button title="Sign in" onPress={submit} loading={busy} style={{ marginTop: space.sm }} />
          <Button title="New here? Create an account" variant="ghost" onPress={() => router.replace("/(auth)/sign-up")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
