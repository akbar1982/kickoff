import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { formatWhen } from "../../lib/hooks";
import { colors, space, type } from "../../lib/theme";
import { column, widths } from "../../lib/layout";

interface Room {
  key: string;
  section?: string;                // header shown above the first room of a section
  matchId?: string;                // neither id = community chat
  groupId?: string;
  title: string;
  startsAt?: string;
  cancelled?: boolean;
  last?: { body: string; name: string; at: string };
}

// Game chats stay listed for a day after kick-off so players can sort out the aftermath.
const KEEP_AFTER_MS = 24 * 60 * 60_000;

export default function Chats() {
  const { session, role } = useAuth();
  const me = session?.user.id;
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    const since = new Date(Date.now() - KEEP_AFTER_MS).toISOString();

    // Games whose chat I can open: ones I host or joined (the host is auto-joined), or all of them for admins.
    const games = role === "admin"
      ? await supabase.from("matches").select("id,title,starts_at,status").gte("starts_at", since)
      : await supabase.from("rsvps").select("matches!inner(id,title,starts_at,status)")
          .eq("user_id", me).gte("matches.starts_at", since);
    const list: { id: string; title: string; starts_at: string; status: string }[] = role === "admin"
      ? (games.data ?? []) as any
      : ((games.data ?? []) as any[]).map((r) => r.matches);

    let gq = supabase.from("group_overview").select("id,name").order("name");
    if (role !== "admin") gq = gq.eq("my_status", "active");
    const { data: groupList } = await gq;
    const groups = (groupList ?? []) as { id: string; name: string }[];

    // Latest message per room. Fine at this app's size; switch to a view if chats get busy.
    const gameIds = list.map((g) => g.id), groupIds = groups.map((g) => g.id);
    const filter = ["and(match_id.is.null,group_id.is.null)",
      ...(gameIds.length ? [`match_id.in.(${gameIds.join(",")})`] : []),
      ...(groupIds.length ? [`group_id.in.(${groupIds.join(",")})`] : [])].join(",");
    const { data: recent } = await supabase.from("chat_messages")
      .select("match_id,group_id,body,created_at,profiles(display_name)")
      .or(filter).order("created_at", { ascending: false }).limit(300);
    const last = new Map<string, Room["last"]>();
    for (const m of (recent ?? []) as any[]) {
      const key = m.match_id ?? m.group_id ?? "community";
      if (!last.has(key)) last.set(key, { body: m.body, name: m.profiles?.display_name ?? "Player", at: m.created_at });
    }

    const groupRooms: Room[] = groups.map((g, i) => ({
      key: g.id, section: i === 0 ? "Your groups" : undefined, groupId: g.id, title: g.name, last: last.get(g.id),
    }));
    const gameRooms: Room[] = list
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
      .map((g, i) => ({
        key: g.id, section: i === 0 ? "Your games" : undefined, matchId: g.id, title: g.title,
        startsAt: g.starts_at, cancelled: g.status === "cancelled", last: last.get(g.id),
      }));
    setRooms([{ key: "community", title: "Community", last: last.get("community") }, ...groupRooms, ...gameRooms]);
  }, [me, role]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (r: Room) => r.matchId
    ? router.push({ pathname: "/match/[id]/chat", params: { id: r.matchId } })
    : r.groupId ? router.push({ pathname: "/group/[id]/chat", params: { id: r.groupId } })
    : router.push("/community-chat");

  return (
    <FlatList showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[{ padding: space.md }, column(widths.page)]}
      data={rooms}
      keyExtractor={(r) => r.key}
      refreshControl={<RefreshControl tintColor={colors.accent} refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      renderItem={({ item }) => (
        <>
          {item.section && <Text style={[type.label, { marginTop: space.md, marginBottom: space.sm }]}>{item.section}</Text>}
          <Pressable onPress={() => open(item)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: space.sm })}>
            <Card style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
                backgroundColor: item.matchId || item.groupId ? colors.surfaceHi : colors.accent }}>
                <Ionicons name={item.matchId ? "football" : item.groupId ? "shield" : "globe-outline"} size={22}
                  color={item.matchId || item.groupId ? colors.accent : colors.accentInk} />
              </View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[type.body, { fontWeight: "700", flexShrink: 1 }]} numberOfLines={1}>{item.title}</Text>
                  {item.cancelled && <Chip label="Cancelled" tone="warn" />}
                </View>
                {item.startsAt && <Text style={type.small}>{formatWhen(item.startsAt)}</Text>}
                <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>
                  {item.last ? `${item.last.name}: ${item.last.body}` : item.matchId || item.groupId ? "No messages yet" : "Chat with everyone in Kickoff"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Card>
          </Pressable>
        </>
      )}
      ListFooterComponent={rooms.length === 1 ? (
        <Text style={[type.small, { marginTop: space.md, textAlign: "center" }]}>
          Join a group or a game and its chat will show up here.
        </Text>
      ) : undefined}
    />
  );
}
