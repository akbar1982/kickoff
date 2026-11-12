import React from "react";
import { Pressable } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { t } from "../../lib/i18n";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
const tab = (focused: Icon, idle: Icon) => ({ color, focused: f, size }: { color: any; focused: boolean; size: number }) =>
  <Ionicons name={f ? focused : idle} size={size} color={color as string} />;

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: "800", fontSize: 22 },
      headerShadowVisible: false,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 84, paddingTop: 6 },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index" options={{
        title: t("nav.games"), tabBarIcon: tab("football", "football-outline"),
        headerRight: () => (
          <Pressable onPress={() => router.push("/create")} hitSlop={10} style={{ marginRight: 16 }}>
            <Ionicons name="add-circle" size={28} color={colors.accent} />
          </Pressable>
        ),
      }} />
      <Tabs.Screen name="map" options={{ title: t("nav.map"), headerShown: false, tabBarIcon: tab("map", "map-outline") }} />
      <Tabs.Screen name="groups" options={{ title: t("nav.groups"), tabBarIcon: tab("people", "people-outline") }} />
      <Tabs.Screen name="chat" options={{ title: t("nav.chat"), tabBarIcon: tab("chatbubbles", "chatbubbles-outline") }} />
      <Tabs.Screen name="profile" options={{ title: t("nav.me"), tabBarIcon: tab("person", "person-outline") }} />
    </Tabs>
  );
}
