import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Chip } from "./ui";
import { showSheet } from "./ActionSheet";
import { block, report } from "../lib/safety";
import { freshChannel, supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { colors, radius, space, type } from "../lib/theme";
import { column, widths } from "../lib/layout";
import type { ChatMessage } from "../lib/types";

const PAGE = 100;
const COLUMNS = "id,match_id,group_id,user_id,body,created_at,profiles(display_name,role)";

/** One chat room: a game's, a group's, or (neither given) the community chat everyone can see. */
export function ChatRoom({ matchId = null, groupId = null }: { matchId?: string | null; groupId?: string | null }) {
  const { session, role } = useAuth();
  const me = session?.user.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);   // newest first (list is inverted)
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const q = supabase.from("chat_messages").select(COLUMNS);
    const inRoom = matchId ? q.eq("match_id", matchId) : groupId ? q.eq("group_id", groupId) : q.is("match_id", null).is("group_id", null);
    const { data, error } = await inRoom.order("created_at", { ascending: false }).limit(PAGE);
    if (error) Alert.alert("Couldn't load chat", error.message);
    else setMessages(data as unknown as ChatMessage[]);
  }, [matchId, groupId]);

  useEffect(() => {
    load();
    // Realtime rows don't carry the sender's name, so fetch each new message with its profile.
    const ch = freshChannel(`chat-${matchId ?? groupId ?? "community"}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        ...(matchId ? { filter: `match_id=eq.${matchId}` } : groupId ? { filter: `group_id=eq.${groupId}` } : {}),
      }, async (payload) => {
        const row = payload.new as ChatMessage;
        if ((row.match_id ?? null) !== matchId || (row.group_id ?? null) !== groupId) return;
        const { data } = await supabase.from("chat_messages").select(COLUMNS).eq("id", row.id).single();
        if (data) setMessages((prev) => prev.some((m) => m.id === row.id) ? prev : [data as unknown as ChatMessage, ...prev]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as { id: string }).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, groupId, load]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !me) return;
    setSending(true);
    const { data, error } = await supabase.from("chat_messages")
      .insert({ match_id: matchId, group_id: groupId, user_id: me, body }).select(COLUMNS).single();
    setSending(false);
    if (error) { Alert.alert("Couldn't send", error.message); return; }
    setDraft("");
    setMessages((prev) => prev.some((m) => m.id === (data as any).id) ? prev : [data as unknown as ChatMessage, ...prev]);
  };

  const remove = async (m: ChatMessage) => {
    const { error } = await supabase.from("chat_messages").delete().eq("id", m.id);
    if (error) Alert.alert("Couldn't delete", error.message);
    else setMessages((prev) => prev.filter((x) => x.id !== m.id));
  };

  // Long-press: delete your own messages (admins can delete any); report or block anyone else.
  const showActions = (m: ChatMessage) => {
    const mine = m.user_id === me;
    const name = m.profiles?.display_name ?? "this player";
    showSheet({
      title: mine ? undefined : name,
      options: [
        ...(mine || role === "admin" ? [{ label: "Delete message", destructive: true, onPress: () => remove(m) }] : []),
        ...(mine ? [] : [
          { label: "Report message", onPress: () => report({ userId: m.user_id, messageId: m.id }) },
          { label: `Block ${name}`, destructive: true, onPress: async () => {
            if (await block({ id: m.user_id, name })) setMessages((prev) => prev.filter((x) => x.user_id !== m.user_id));
          } },
        ]),
      ],
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}
      style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList showsVerticalScrollIndicator={false}
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[{ padding: space.md }, column(widths.page)]}
        renderItem={({ item, index }) => {
          const mine = item.user_id === me;
          // inverted list: the next-older message is at index + 1
          const older = messages[index + 1];
          const showName = !mine && older?.user_id !== item.user_id;
          const r = item.profiles?.role;
          return (
            <Pressable onLongPress={() => showActions(item)} delayLongPress={350}
              style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%", marginTop: showName ? space.md : 4 }}>
              {showName && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, marginLeft: 4 }}>
                  <Text style={[type.small, { fontWeight: "700" }]}>{item.profiles?.display_name ?? "Player"}</Text>
                  {r === "admin" && <Chip label="Admin" tone="accent" />}
                </View>
              )}
              <View style={{
                backgroundColor: mine ? colors.accent : colors.surfaceHi, borderRadius: radius.md,
                paddingHorizontal: 14, paddingVertical: 10,
              }}>
                <Text style={{ color: mine ? colors.accentInk : colors.text, fontSize: 15 }}>{item.body}</Text>
                <Text style={{ color: mine ? "rgba(11,15,13,0.55)" : colors.muted, fontSize: 11, marginTop: 4, alignSelf: "flex-end" }}>
                  {new Date(item.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80, transform: [{ scaleY: -1 }] }}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.muted} />
            <Text style={[type.small, { marginTop: space.sm }]}>No messages yet. Say hi!</Text>
          </View>
        }
      />
      <View style={{ padding: space.sm, paddingBottom: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg }}>
        <View style={[{ flexDirection: "row", alignItems: "flex-end" }, column(widths.page)]}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Message" placeholderTextColor={colors.muted}
            multiline maxLength={2000}
            style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16,
              paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12 }} />
          <Pressable onPress={send} disabled={!draft.trim() || sending} hitSlop={8}
            style={{ width: 44, height: 44, borderRadius: 22, marginLeft: space.sm, alignItems: "center", justifyContent: "center",
              backgroundColor: draft.trim() ? colors.accent : colors.surfaceHi }}>
            <Ionicons name="arrow-up" size={22} color={draft.trim() ? colors.accentInk : colors.muted} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
