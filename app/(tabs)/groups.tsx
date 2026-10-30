import React, { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Chip } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { colors, space, type } from "../../lib/theme";
import type { Group } from "../../lib/types";

export default function Groups() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("group_overview").select("*").order("name");
    if (error) Alert.alert("Couldn't load groups", error.message);
    else setGroups(data as Group[]);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (g: Group, accept: boolean) => {
    const { error } = await supabase.rpc("respond_to_invite", { p_group: g.id, p_accept: accept });
    if (error) Alert.alert("Something went wrong", error.message); else load();
  };

  const sections = [
    { title: "Invitations", data: groups.filter((g) => g.my_status === "invited") },
    { title: "Your groups", data: groups.filter((g) => g.my_status === "active") },
    { title: "Waiting for approval", data: groups.filter((g) => g.my_status === "pending") },
    { title: "Discover", data: groups.filter((g) => !g.my_status) },
  ].filter((s) => s.data.length);

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md }}
      sections={sections}
      keyExtractor={(g) => g.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl tintColor={colors.accent} refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <Button title="Start a group" icon="add" variant="secondary" onPress={() => router.push("/group/new")}
          style={{ marginBottom: space.md }} />
      }
      renderSectionHeader={({ section }) => (
        <Text style={[type.label, { marginTop: space.md, marginBottom: space.sm }]}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push({ pathname: "/group/[id]", params: { id: item.id } })}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: space.sm })}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHi,
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 18 }}>{item.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={[type.body, { fontWeight: "700" }]} numberOfLines={1}>{item.name}</Text>
                <Text style={type.small}>{item.member_count} member{item.member_count === 1 ? "" : "s"}</Text>
              </View>
              {item.my_group_role === "organizer" && item.my_status === "active" && (
                <Chip label={item.pending_count ? `${item.pending_count} request${item.pending_count === 1 ? "" : "s"}` : "Organizer"}
                  tone={item.pending_count ? "warn" : "accent"} />
              )}
              {item.my_status !== "invited" && <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 6 }} />}
            </View>
            {item.my_status === "invited" && (
              <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                <Button title="Decline" variant="secondary" onPress={() => respond(item, false)} style={{ flex: 1, height: 44 }} />
                <Button title="Join" onPress={() => respond(item, true)} style={{ flex: 1, height: 44 }} />
              </View>
            )}
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <Text style={[type.small, { textAlign: "center", marginTop: space.xl }]}>
          No groups yet. Start one and invite your players.
        </Text>
      }
    />
  );
}
