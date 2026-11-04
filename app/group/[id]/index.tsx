import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Chip } from "../../../components/ui";
import { MatchCard } from "../../../components/MatchCard";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { upcomingThenPast } from "../../../lib/hooks";
import { colors, space, type } from "../../../lib/theme";
import { column, widths } from "../../../lib/layout";
import type { Group, Match } from "../../../lib/types";

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, role } = useAuth();
  const me = session?.user.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [games, setGames] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [g, m] = await Promise.all([
      supabase.from("group_overview").select("*").eq("id", id).single(),
      supabase.from("match_overview").select("*").eq("group_id", id).eq("status", "open")
        .gte("starts_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).order("starts_at"),
    ]);
    if (g.error) { Alert.alert("Couldn't load group", g.error.message); return; }
    setGroup(g.data as Group);
    setGames((m.data ?? []) as Match[]);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) Alert.alert("Something went wrong", error.message); else load();
  };

  const requestToJoin = () => run(() => supabase.rpc("request_to_join", { p_group: id }));
  const respond = (accept: boolean) => run(() => supabase.rpc("respond_to_invite", { p_group: id, p_accept: accept }));
  const leave = (label: string, message: string) => Alert.alert(label, message, [
    { text: "Cancel", style: "cancel" },
    { text: label, style: "destructive", onPress: () => run(() => supabase.rpc("remove_from_group", { p_group: id, p_user: me })) },
  ]);
  const deleteGroup = () => Alert.alert("Delete this group?", "Its games and chat will be deleted for everyone.", [
    { text: "Keep it", style: "cancel" },
    { text: "Delete group", style: "destructive", onPress: async () => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) Alert.alert("Couldn't delete", error.message); else router.back();
    } },
  ]);

  if (!group) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const member = group.my_status === "active";
  const organizer = member && group.my_group_role === "organizer";
  const admin = role === "admin";
  const { upcoming, past } = upcomingThenPast(games);

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[{ padding: space.md, paddingBottom: space.xl }, column(widths.page)]}>
      <Stack.Screen options={{ title: "" }} />
      <Text style={type.display}>{group.name}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: space.sm }}>
        <Chip label={`${group.member_count} member${group.member_count === 1 ? "" : "s"}`} icon="people" />
        {organizer && <Chip label="You're an organizer" tone="accent" icon="star" />}
        {member && !organizer && <Chip label="Member" tone="good" icon="checkmark-circle" />}
      </View>
      {group.description ? <Text style={[type.body, { marginTop: space.md }]}>{group.description}</Text> : null}

      {/* ── Membership actions ── */}
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        {!group.my_status && <Button title="Ask to join" icon="hand-right" onPress={requestToJoin} loading={busy} />}
        {group.my_status === "pending" && (
          <Card style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="time-outline" size={20} color={colors.warning} />
            <Text style={[type.body, { flex: 1, marginLeft: space.sm }]}>Request sent. An organizer will review it.</Text>
          </Card>
        )}
        {group.my_status === "invited" && (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button title="Decline" variant="secondary" onPress={() => respond(false)} style={{ flex: 1 }} />
            <Button title="Accept invite" onPress={() => respond(true)} loading={busy} style={{ flex: 1 }} />
          </View>
        )}
        {(organizer || admin) && (
          <Button title="Post a game" icon="add-circle" onPress={() => router.push({ pathname: "/create", params: { groupId: id } })} />
        )}
      </View>

      {(member || admin) && (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Row icon="chatbubbles" label="Group chat" onPress={() => router.push({ pathname: "/group/[id]/chat", params: { id } })} />
          <Row icon="people" label={organizer ? "Members & invites" : "Members"}
            badge={organizer && group.pending_count ? `${group.pending_count} waiting` : undefined}
            onPress={() => router.push({ pathname: "/group/[id]/members", params: { id } })} />
        </View>
      )}

      {/* ── Games ── */}
      <Text style={[type.title, { marginTop: space.xl, marginBottom: space.sm }]}>Upcoming games</Text>
      {upcoming.length === 0 && (
        <Text style={type.small}>
          {member || admin ? "No games posted yet." : "Join the group to see its members-only games."}
        </Text>
      )}
      {upcoming.map((m) => <MatchCard key={m.id} match={m} />)}
      {past.length > 0 && <Text style={[type.title, { marginTop: space.lg, marginBottom: space.sm }]}>Past games</Text>}
      {past.map((m) => <MatchCard key={m.id} match={m} />)}

      {/* ── Leave / delete ── */}
      <View style={{ marginTop: space.xl, gap: space.sm }}>
        {group.my_status === "pending" && <Button title="Withdraw request" variant="danger" onPress={() => leave("Withdraw", "Cancel your request to join?")} />}
        {member && <Button title="Leave group" variant="danger" onPress={() => leave("Leave", "You'll lose access to members-only games and the group chat.")} />}
        {(organizer || admin) && <Button title="Delete group" variant="danger" onPress={deleteGroup} />}
      </View>
    </ScrollView>
  );
}

function Row({ icon, label, badge, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; badge?: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name={icon} size={22} color={colors.accent} />
        <Text style={[type.body, { flex: 1, marginLeft: space.sm }]}>{label}</Text>
        {badge && <Chip label={badge} tone="warn" />}
        <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 6 }} />
      </Card>
    </Pressable>
  );
}
