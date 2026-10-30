import React, { useCallback, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Card } from "../components/ui";
import { supabase } from "../lib/supabase";
import { unblock } from "../lib/safety";
import { colors, space, type } from "../lib/theme";

interface Blocked { blocked_id: string; profiles: { display_name: string } | null }

export default function BlockedUsers() {
  const [rows, setRows] = useState<Blocked[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("blocks")
      .select("blocked_id, profiles!blocks_blocked_id_fkey(display_name)").order("created_at", { ascending: false });
    if (error) Alert.alert("Couldn't load blocked users", error.message);
    setRows((data ?? []) as unknown as Blocked[]);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = async (id: string) => {
    try {
      await unblock(id);
      setRows((prev) => prev?.filter((r) => r.blocked_id !== id) ?? null);
    } catch (e: any) {
      Alert.alert("Couldn't unblock", e?.message);
    }
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md }}
      data={rows ?? []}
      keyExtractor={(r) => r.blocked_id}
      ListEmptyComponent={rows ? (
        <Text style={[type.small, { textAlign: "center", marginTop: space.xl }]}>
          You haven't blocked anyone. To block someone, long-press one of their chat messages.
        </Text>
      ) : undefined}
      renderItem={({ item }) => (
        <Card style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[type.body, { flex: 1, fontWeight: "700" }]}>{item.profiles?.display_name ?? "Player"}</Text>
            <Button title="Unblock" variant="secondary" style={{ height: 40 }} onPress={() => remove(item.blocked_id)} />
          </View>
        </Card>
      )}
    />
  );
}
