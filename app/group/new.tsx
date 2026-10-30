import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Field } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors, space, type } from "../../lib/theme";

export default function NewGroup() {
  const router = useRouter();
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (name.trim().length < 3) { setError("Give the group a name (3+ characters)"); return; }
    if (!session) return;
    setBusy(true);
    const { data, error } = await supabase.from("groups")
      .insert({ name: name.trim(), description: description.trim() || null, created_by: session.user.id })
      .select("id").single();
    setBusy(false);
    if (error) { Alert.alert("Couldn't create group", error.message); return; }
    router.replace({ pathname: "/group/[id]", params: { id: data.id } });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
        <Text style={[type.small, { marginBottom: space.lg }]}>
          You'll be the group's organizer. You can invite players, approve join requests, post games, and make others organizers too.
        </Text>
        <Field label="Group name" value={name} onChangeText={setName} error={error} placeholder="Sunday Ballers" maxLength={60} />
        <Field label="About (optional)" value={description} onChangeText={setDescription} multiline maxLength={500}
          placeholder="Friendly 7-a-side, all levels welcome."
          style={{ height: 96, paddingTop: 14, textAlignVertical: "top" }} />
        <Button title="Create group" icon="checkmark-circle" onPress={create} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
