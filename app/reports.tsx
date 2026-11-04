import React, { useCallback, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Card, Chip } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { deleteAccount } from "../lib/safety";
import { formatWhen } from "../lib/hooks";
import { colors, space, type } from "../lib/theme";
import { column, widths } from "../lib/layout";

interface Report {
  id: string; reason: string; message_id: string | null; message_body: string | null;
  reported_user_id: string; created_at: string;
  reporter: { display_name: string } | null;
  reported: { display_name: string } | null;
}

const REASON_LABEL: Record<string, string> = {
  harassment: "Harassment", hate: "Hate speech", sexual: "Sexual / violent", spam: "Spam", other: "Other",
};

/** Admins work through open reports: delete the message, remove the user, or dismiss. */
export default function Reports() {
  const { role } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("reports")
      .select(`id, reason, message_id, message_body, reported_user_id, created_at,
        reporter:profiles!reports_reporter_id_fkey(display_name),
        reported:profiles!reports_reported_user_id_fkey(display_name)`)
      .eq("status", "open").order("created_at");
    if (error) Alert.alert("Couldn't load reports", error.message);
    setReports((data ?? []) as unknown as Report[]);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Resolves this report and any other open reports it settles (same message, or same user when removed).
  const resolve = async (ids: string[]) => {
    const { error } = await supabase.from("reports").update({ status: "resolved" }).in("id", ids);
    if (error) Alert.alert("Couldn't update report", error.message);
    setReports((prev) => prev?.filter((r) => !ids.includes(r.id)) ?? null);
  };

  const act = async (r: Report, action: () => Promise<void>, settles: (x: Report) => boolean) => {
    setBusy(r.id);
    try {
      await action();
      await resolve((reports ?? []).filter(settles).map((x) => x.id));
    } catch (e: any) {
      Alert.alert("Couldn't do that", e?.message ?? "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const deleteMessage = (r: Report) => act(r, async () => {
    const { error } = await supabase.from("chat_messages").delete().eq("id", r.message_id!);
    if (error) throw error;
  }, (x) => x.id === r.id || (!!r.message_id && x.message_id === r.message_id));

  const removeUser = (r: Report) => Alert.alert(
    `Remove ${r.reported?.display_name ?? "this user"}?`,
    "Their account, messages and hosted games are deleted permanently.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive",
        onPress: () => act(r, async () => { await deleteAccount(r.reported_user_id); },
          (x) => x.reported_user_id === r.reported_user_id) },
    ],
  );

  if (role !== "admin") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={type.small}>Only admins can review reports.</Text>
      </View>
    );
  }

  return (
    <FlatList showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[{ padding: space.md }, column(widths.page)]}
      data={reports ?? []}
      keyExtractor={(r) => r.id}
      onRefresh={load}
      refreshing={false}
      ListEmptyComponent={reports ? (
        <Text style={[type.small, { textAlign: "center", marginTop: space.xl }]}>No open reports. 🎉</Text>
      ) : undefined}
      renderItem={({ item: r }) => (
        <Card style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Chip label={REASON_LABEL[r.reason] ?? r.reason} tone="warn" />
            <Text style={type.small}>{formatWhen(r.created_at)}</Text>
          </View>
          <Text style={[type.body, { marginTop: space.sm }]}>
            <Text style={{ fontWeight: "700" }}>{r.reported?.display_name ?? "Deleted user"}</Text>
            <Text style={{ color: colors.muted }}> reported by {r.reporter?.display_name ?? "a deleted user"}</Text>
          </Text>
          {r.message_body != null && (
            <View style={{ backgroundColor: colors.surfaceHi, borderRadius: 12, padding: space.sm + 4, marginTop: space.sm }}>
              <Text style={type.body}>{r.message_body}</Text>
              {!r.message_id && <Text style={[type.small, { marginTop: 4 }]}>Message already deleted</Text>}
            </View>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
            {r.message_id && (
              <Button title="Delete message" variant="danger" style={{ height: 40 }} disabled={busy === r.id}
                onPress={() => deleteMessage(r)} />
            )}
            <Button title="Remove user" variant="danger" style={{ height: 40 }} disabled={busy === r.id}
              onPress={() => removeUser(r)} />
            <Button title="Dismiss" variant="secondary" style={{ height: 40 }} disabled={busy === r.id}
              onPress={() => act(r, async () => {}, (x) => x.id === r.id)} />
          </View>
        </Card>
      )}
    />
  );
}
