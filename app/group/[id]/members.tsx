import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip } from "../../../components/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { colors, radius, space, type } from "../../../lib/theme";
import { column, widths } from "../../../lib/layout";
import type { GroupMember } from "../../../lib/types";
import { t } from "../../../lib/i18n";

export default function GroupMembers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [everyone, setEveryone] = useState<{ id: string; display_name: string }[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([
      supabase.from("group_members").select("user_id,role,status,profiles(display_name)").eq("group_id", id).order("created_at"),
      supabase.from("profiles").select("id,display_name").order("display_name"),
    ]);
    if (m.error) { Alert.alert(t("members.loadFailed"), m.error.message); return; }
    setMembers(m.data as unknown as GroupMember[]);
    setEveryone(p.data ?? []);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const organizer = members.some((m) => m.user_id === me && m.status === "active" && m.role === "organizer");
  const active = members.filter((m) => m.status === "active");
  const requests = members.filter((m) => m.status === "pending");
  const invited = members.filter((m) => m.status === "invited");

  // People to invite: everyone not already in, requested or invited.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set(members.map((m) => m.user_id));
    return everyone.filter((p) => !taken.has(p.id) && p.display_name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, everyone, members]);

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fn, args);
    if (error) Alert.alert(t("common.somethingWrong"), error.message); else load();
  };
  const name = (m: GroupMember) => m.profiles?.display_name ?? t("common.player");

  const memberActions = (m: GroupMember) => {
    if (!organizer || m.user_id === me) return;
    const promote = m.role === "organizer"
      ? { text: t("members.makeParticipant"), onPress: () => rpc("set_group_role", { p_group: id, p_user: m.user_id, p_role: "participant" }) }
      : { text: t("members.makeOrganizer"), onPress: () => rpc("set_group_role", { p_group: id, p_user: m.user_id, p_role: "organizer" }) };
    Alert.alert(name(m), undefined, [
      promote,
      { text: t("members.removeFromGroup"), style: "destructive", onPress: () => rpc("remove_from_group", { p_group: id, p_user: m.user_id }) },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[{ padding: space.md, paddingBottom: space.xl }, column(widths.page)]}
      keyboardShouldPersistTaps="handled">
      {organizer && (
        <>
          <Text style={[type.label, { marginBottom: space.sm }]}>{t("members.invitePlayers")}</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder={t("common.searchByName")} placeholderTextColor={colors.muted}
            style={{ height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
              color: colors.text, paddingHorizontal: space.md, fontSize: 16 }} />
          {candidates.map((p) => (
            <Card key={p.id} style={{ flexDirection: "row", alignItems: "center", marginTop: space.sm }}>
              <Text style={[type.body, { flex: 1 }]}>{p.display_name}</Text>
              <Pressable hitSlop={8} onPress={() => { setQuery(""); rpc("invite_to_group", { p_group: id, p_user: p.id }); }}>
                <Text style={{ color: colors.accent, fontWeight: "700" }}>{t("members.invite")}</Text>
              </Pressable>
            </Card>
          ))}
          {query.trim() !== "" && candidates.length === 0 && <Text style={[type.small, { marginTop: space.sm }]}>{t("members.noMatch")}</Text>}
        </>
      )}

      {organizer && requests.length > 0 && (
        <Section title={t("members.requests", { count: requests.length })}>
          {requests.map((m, i) => (
            <Line key={m.user_id} first={i === 0} label={name(m)}>
              <Pressable hitSlop={8} onPress={() => rpc("review_join_request", { p_group: id, p_user: m.user_id, p_approve: false })}>
                <Ionicons name="close-circle" size={28} color={colors.muted} />
              </Pressable>
              <Pressable hitSlop={8} style={{ marginLeft: space.md }}
                onPress={() => rpc("review_join_request", { p_group: id, p_user: m.user_id, p_approve: true })}>
                <Ionicons name="checkmark-circle" size={28} color={colors.accent} />
              </Pressable>
            </Line>
          ))}
        </Section>
      )}

      <Section title={t("members.members", { count: active.length })}>
        {active.map((m, i) => (
          <Pressable key={m.user_id} onPress={() => memberActions(m)} disabled={!organizer || m.user_id === me}>
            <Line first={i === 0} label={`${name(m)}${m.user_id === me ? ` ${t("common.you")}` : ""}`}>
              {m.role === "organizer" && <Chip label={t("common.organizer")} tone="accent" />}
              {organizer && m.user_id !== me && <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} style={{ marginLeft: 8 }} />}
            </Line>
          </Pressable>
        ))}
      </Section>
      {organizer && <Text style={[type.small, { marginTop: space.sm }]}>{t("members.tapHint")}</Text>}

      {organizer && invited.length > 0 && (
        <Section title={t("members.invited", { count: invited.length })}>
          {invited.map((m, i) => (
            <Line key={m.user_id} first={i === 0} label={name(m)}>
              <Pressable hitSlop={8} onPress={() => rpc("remove_from_group", { p_group: id, p_user: m.user_id })}>
                <Text style={{ color: colors.muted, fontWeight: "700" }}>{t("common.cancel")}</Text>
              </Pressable>
            </Line>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={[type.label, { marginTop: space.xl, marginBottom: space.sm }]}>{title}</Text>
      <Card>{children}</Card>
    </>
  );
}

function Line({ label, first, children }: { label: string; first: boolean; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>{label.slice(0, 1).toUpperCase()}</Text>
      </View>
      <Text style={[type.body, { flex: 1, marginLeft: 10 }]} numberOfLines={1}>{label}</Text>
      {children}
    </View>
  );
}
