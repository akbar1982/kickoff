import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Field } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useUserLocation } from "../../lib/hooks";
import { colors, space, type } from "../../lib/theme";
import { column, widths } from "../../lib/layout";
import { t } from "../../lib/i18n";

export default function NewGroup() {
  const router = useRouter();
  const { session } = useAuth();
  const { coords, granted } = useUserLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (name.trim().length < 3) { setError(t("newGroup.errName")); return; }
    if (!session) return;
    setBusy(true);
    const { data, error } = await supabase.from("groups")
      .insert({ name: name.trim(), description: description.trim() || null, created_by: session.user.id,
        // the group's area for "near you" lists, to about 1 km so it doesn't pinpoint the creator
        ...(granted && { lat: +coords.lat.toFixed(2), lng: +coords.lng.toFixed(2) }) })
      .select("id").single();
    setBusy(false);
    if (error) { Alert.alert(t("newGroup.failed"), error.message); return; }
    router.replace({ pathname: "/group/[id]", params: { id: data.id } });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[{ padding: space.md }, column(widths.form)]} keyboardShouldPersistTaps="handled">
        <Text style={[type.small, { marginBottom: space.lg }]}>
          {t("newGroup.intro")}
        </Text>
        <Field label={t("newGroup.name")} value={name} onChangeText={setName} error={error} placeholder={t("newGroup.namePlaceholder")} maxLength={60} />
        <Field label={t("newGroup.about")} value={description} onChangeText={setDescription} multiline maxLength={500}
          placeholder={t("newGroup.aboutPlaceholder")}
          style={{ height: 96, paddingTop: 14, textAlignVertical: "top" }} />
        <Button title={t("newGroup.create")} icon="checkmark-circle" onPress={create} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
