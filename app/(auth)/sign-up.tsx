import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Field, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { colors, space, type } from "../../lib/theme";
import { column, useLayout, widths } from "../../lib/layout";
import { t } from "../../lib/i18n";

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
    if (name.trim().length < 2) e.name = t("signUp.errName");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = t("signUp.errEmail");
    if (password.length < 8) e.password = t("signUp.errPassword");
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const { needsConfirmation } = await signUpWithEmail(name, email, password);
      if (needsConfirmation) {
        Alert.alert(t("signUp.checkInbox"), t("signUp.checkInboxBody"), [
          { text: t("common.ok"), onPress: () => router.replace("/(auth)/sign-in") },
        ]);
      }
    } catch (err: any) {
      Alert.alert(t("signUp.failed"), err?.message ?? t("common.tryAgain"));
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {/* on iPad the form sits centred on the screen; on phones it starts at the top */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[{ padding: space.lg, flexGrow: 1, justifyContent: wide ? "center" : "flex-start" }, column(widths.form)]}
          keyboardShouldPersistTaps="handled">
          <Text style={type.display}>{t("signUp.title")}</Text>
          <Text style={[type.body, { color: colors.muted, marginBottom: space.xl, marginTop: space.sm }]}>
            {t("signUp.subtitle")}
          </Text>
          <Field label={t("common.name")} value={name} onChangeText={setName} error={errors.name}
            autoComplete="name" placeholder={t("signUp.namePlaceholder")} />
          <Field label={t("common.email")} value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none"
            keyboardType="email-address" autoComplete="email" placeholder={t("common.emailPlaceholder")} />
          <Field label={t("common.password")} value={password} onChangeText={setPassword} error={errors.password}
            secureTextEntry autoComplete="new-password" placeholder={t("signUp.passwordPlaceholder")} />
          <Button title={t("signUp.button")} onPress={submit} loading={busy} style={{ marginTop: space.sm }} />
          <Button title={t("signUp.toSignIn")} variant="ghost" onPress={() => router.replace("/(auth)/sign-in")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
