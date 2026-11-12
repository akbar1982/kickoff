import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Field, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { colors, space, type } from "../../lib/theme";
import { column, useLayout, widths } from "../../lib/layout";
import { t } from "../../lib/i18n";

export default function SignIn() {
  const { wide } = useLayout();
  const { signInWithEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.includes("@") || password.length < 6) {
      Alert.alert(t("signIn.checkDetails"), t("signIn.checkDetailsBody"));
      return;
    }
    setBusy(true);
    try { await signInWithEmail(email, password); }
    catch (e: any) { Alert.alert(t("signIn.failed"), e?.message ?? t("common.tryAgain")); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {/* on iPad the form sits centred on the screen; on phones it starts at the top */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[{ padding: space.lg, flexGrow: 1, justifyContent: wide ? "center" : "flex-start" }, column(widths.form)]}
          keyboardShouldPersistTaps="handled">
          <Text style={type.display}>{t("signIn.title")}</Text>
          <Text style={[type.body, { color: colors.muted, marginBottom: space.xl, marginTop: space.sm }]}>
            {t("signIn.subtitle")}
          </Text>
          <Field label={t("common.email")} value={email} onChangeText={setEmail} autoCapitalize="none"
            keyboardType="email-address" autoComplete="email" placeholder={t("common.emailPlaceholder")} />
          <Field label={t("common.password")} value={password} onChangeText={setPassword} secureTextEntry
            autoComplete="password" placeholder="••••••••" />
          <Button title={t("signIn.button")} onPress={submit} loading={busy} style={{ marginTop: space.sm }} />
          <Button title={t("signIn.toSignUp")} variant="ghost" onPress={() => router.replace("/(auth)/sign-up")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
