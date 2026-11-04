import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Field, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { colors, space, type } from "../../lib/theme";
import { column, useLayout, widths } from "../../lib/layout";

export default function SignUp() {
  const { wide } = useLayout();
  const { signUpWithEmail } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Enter a valid email";
    if (password.length < 8) e.password = "Use at least 8 characters";
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const { needsConfirmation } = await signUpWithEmail(name, email, password);
      if (needsConfirmation) {
        Alert.alert("Check your inbox", "We sent a confirmation link. Open it, then sign in.", [
          { text: "OK", onPress: () => router.replace("/(auth)/sign-in") },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Couldn't create account", err?.message ?? "Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {/* on iPad the form sits centred on the screen; on phones it starts at the top */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[{ padding: space.lg, flexGrow: 1, justifyContent: wide ? "center" : "flex-start" }, column(widths.form)]}
          keyboardShouldPersistTaps="handled">
          <Text style={type.display}>Join the squad</Text>
          <Text style={[type.body, { color: colors.muted, marginBottom: space.xl, marginTop: space.sm }]}>
            Create your account in under a minute.
          </Text>
          <Field label="Name" value={name} onChangeText={setName} error={errors.name}
            autoComplete="name" placeholder="Alex Morgan" />
          <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none"
            keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
          <Field label="Password" value={password} onChangeText={setPassword} error={errors.password}
            secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" />
          <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: space.sm }} />
          <Button title="Already registered? Sign in" variant="ghost" onPress={() => router.replace("/(auth)/sign-in")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
