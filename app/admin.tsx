import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { Card } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { colors, radius, space, type } from "../lib/theme";
import type { Profile, Role } from "../lib/types";

const ROLES: { value: Role; label: string }[] = [
  { value: "participant", label: "Member" },
  { value: "admin", label: "Admin" },
];

export default function Members() {
  const { session, role } = useAuth();
  const me = session?.user.id;
  const [people, setPeople] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("id,display_name,avatar_url,role").order("display_name");
    if (error) Alert.alert("Couldn't load members", error.message);
    else setPeople(data as Profile[]);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter((p) => p.display_name.toLowerCase().includes(q)) : people;
  }, [people, query]);

  const setRole = async (p: Profile, next: Role) => {
    if (next === p.role) return;
    Haptics.selectionAsync();
    setPeople((prev) => prev.map((x) => x.id === p.id ? { ...x, role: next } : x));
    const { error } = await supabase.rpc("set_user_role", { p_user: p.id, p_role: next });
    if (error) { Alert.alert("Couldn't change role", error.message); load(); }
  };

  if (role !== "admin") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={type.small}>Only admins can manage users.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md }}
      data={shown}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <TextInput value={query} onChangeText={setQuery} placeholder="Search by name" placeholderTextColor={colors.muted}
          style={{ height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
            color: colors.text, paddingHorizontal: space.md, fontSize: 16, marginBottom: space.md }} />
      }
      renderItem={({ item }) => (
        <Card style={{ marginBottom: space.sm }}>
          <Text style={[type.body, { fontWeight: "700", marginBottom: space.sm }]}>
            {item.display_name}{item.id === me ? " (you)" : ""}
          </Text>
          <View style={{ flexDirection: "row", backgroundColor: colors.surfaceHi, borderRadius: radius.pill, padding: 3 }}>
            {ROLES.map((r) => {
              const on = item.role === r.value;
              return (
                <Pressable key={r.value} disabled={item.id === me} onPress={() => setRole(item, r.value)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center",
                    backgroundColor: on ? colors.accent : "transparent", opacity: item.id === me && !on ? 0.4 : 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: on ? colors.accentInk : colors.muted }}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}
    />
  );
}
