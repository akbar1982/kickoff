import React, { useCallback, useState } from "react";
import { Alert, AppState, Linking, ScrollView, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { Button, Card } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { colors, space, type } from "../lib/theme";
import { column, widths } from "../lib/layout";
import { t } from "../lib/i18n";

type Kind = "new_games" | "group_chat" | "game_chat";
const kinds: { key: Kind; label: "notify.newGames" | "notify.groupChat" | "notify.gameChat" }[] = [
  { key: "new_games", label: "notify.newGames" },
  { key: "group_chat", label: "notify.groupChat" },
  { key: "game_chat", label: "notify.gameChat" },
];
const allOn = { new_games: true, group_chat: true, game_chat: true };

export default function NotificationSettings() {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState<Record<Kind, boolean>>(allOn);
  const [allowed, setAllowed] = useState(true);

  useFocusEffect(useCallback(() => {
    supabase.from("notification_settings").select("new_games,group_chat,game_chat").maybeSingle()
      .then(({ data }) => setPrefs(data ?? allOn));   // no row yet = everything on
    // re-check when coming back from the phone's settings
    const check = () => Notifications.getPermissionsAsync().then((p) => setAllowed(p.granted)).catch(() => {});
    check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => sub.remove();
  }, []));

  const toggle = async (key: Kind, on: boolean) => {
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    const { error } = await supabase.from("notification_settings").upsert({ user_id: session?.user.id, ...next });
    if (error) { setPrefs(prefs); Alert.alert(t("notify.saveFailed"), error.message); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[{ padding: space.md }, column(widths.page)]}>
      {!allowed && (
        <Card style={{ marginBottom: space.md }}>
          <Text style={type.body}>{t("notify.off")}</Text>
          <Button title={t("notify.openSettings")} variant="secondary" icon="settings" style={{ marginTop: space.md }}
            onPress={() => Linking.openSettings()} />
        </Card>
      )}
      <Card style={{ paddingVertical: 0 }}>
        {kinds.map(({ key, label }, i) => (
          <View key={key} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12,
            borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <Text style={[type.body, { flex: 1 }]}>{t(label)}</Text>
            <Switch value={prefs[key]} onValueChange={(on) => toggle(key, on)}
              trackColor={{ true: colors.accent, false: colors.surfaceHi }} thumbColor={colors.text} />
          </View>
        ))}
      </Card>
      <Text style={[type.small, { marginTop: space.md }]}>{t("notify.hint")}</Text>
    </ScrollView>
  );
}
