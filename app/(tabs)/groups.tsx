import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Chip } from "../../components/ui";
import { RadiusButton } from "../../components/RadiusButton";
import { formatDistance, useRadius, useUserLocation } from "../../lib/hooks";
import { distanceKm } from "../../lib/places";
import { supabase } from "../../lib/supabase";
import { colors, space, type } from "../../lib/theme";
import { column, widths } from "../../lib/layout";
import type { Group } from "../../lib/types";
import { t } from "../../lib/i18n";

export default function Groups() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { coords, granted } = useUserLocation();
  const radius = useRadius();

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("group_overview").select("*").order("name");
    if (error) Alert.alert(t("groups.loadFailed"), error.message);
    else setGroups(data as Group[]);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (g: Group, accept: boolean) => {
    const { error } = await supabase.rpc("respond_to_invite", { p_group: g.id, p_accept: accept });
    if (error) Alert.alert(t("common.somethingWrong"), error.message); else load();
  };

  const away = (g: Group) => granted && g.lat != null && g.lng != null ? distanceKm(coords, { lat: g.lat, lng: g.lng }) : undefined;

  // Your groups always show; Discover lists groups within the radius, nearest first (unplaced groups last).
  const sections = useMemo(() => {
    const discover = groups.filter((g) => !g.my_status).map((g) => ({ g, d: away(g) }))
      .filter(({ d }) => radius === null || d === undefined || d <= radius)
      .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity))
      .map(({ g }) => g);
    return [
      { key: "invited", title: t("groups.invitations"), data: groups.filter((g) => g.my_status === "invited") },
      { key: "active", title: t("groups.yours"), data: groups.filter((g) => g.my_status === "active") },
      { key: "pending", title: t("groups.waiting"), data: groups.filter((g) => g.my_status === "pending") },
      { key: "discover", title: t("groups.discover"), data: discover },
    ].filter((s) => s.data.length || (s.key === "discover" && granted && groups.some((g) => !g.my_status)));
  }, [groups, coords, granted, radius]);

  return (
    <SectionList showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[{ padding: space.md }, column(widths.page)]}
      sections={sections}
      keyExtractor={(g) => g.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl tintColor={colors.accent} refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <Button title={t("groups.start")} icon="add" variant="secondary" onPress={() => router.push("/group/new")}
          style={{ marginBottom: space.md }} />
      }
      renderSectionHeader={({ section }) => (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md, marginBottom: space.sm }}>
          <Text style={type.label}>{section.title}</Text>
          {section.key === "discover" && granted && <RadiusButton />}
        </View>
      )}
      renderSectionFooter={({ section }) => section.key === "discover" && !section.data.length
        ? <Text style={[type.small, { marginBottom: space.md }]}>{t("groups.noneNearby")}</Text>
        : null}
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
                <Text style={type.small}>
                  {t("common.members", { count: item.member_count })}
                  {!item.my_status && away(item) !== undefined ? ` · ${formatDistance(away(item)!)}` : ""}
                </Text>
              </View>
              {item.my_group_role === "organizer" && item.my_status === "active" && (
                <Chip label={item.pending_count ? t("groups.requests", { count: item.pending_count }) : t("common.organizer")}
                  tone={item.pending_count ? "warn" : "accent"} />
              )}
              {item.my_status !== "invited" && <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 6 }} />}
            </View>
            {item.my_status === "invited" && (
              <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                <Button title={t("common.decline")} variant="secondary" onPress={() => respond(item, false)} style={{ flex: 1, height: 44 }} />
                <Button title={t("common.join")} onPress={() => respond(item, true)} style={{ flex: 1, height: 44 }} />
              </View>
            )}
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <Text style={[type.small, { textAlign: "center", marginTop: space.xl }]}>
          {t("groups.empty")}
        </Text>
      }
    />
  );
}
