import React, { useMemo, useState } from "react";
import { RefreshControl, SectionList, Text, View } from "react-native";
import { Screen } from "../../components/ui";
import { MatchCard } from "../../components/MatchCard";
import { RadiusButton } from "../../components/RadiusButton";
import { upcomingThenPast, useMatches, useRadius, useUserLocation } from "../../lib/hooks";
import { useAuth } from "../../lib/auth";
import { distanceKm } from "../../lib/places";
import { colors, space, type } from "../../lib/theme";
import { rows, useLayout } from "../../lib/layout";
import { t } from "../../lib/i18n";

export default function Feed() {
  const { matches, loading, error, reload } = useMatches();
  const { coords, granted } = useUserLocation();
  const radius = useRadius();
  const { session } = useAuth();
  const { columns } = useLayout();
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const withDist = (m: (typeof matches)[number]) => ({ m, d: distanceKm(coords, { lat: m.lat, lng: m.lng }) });
    // games within the radius, plus your own wherever they are; no location = no filter
    const near = !granted || radius === null ? matches : matches.filter((m) =>
      m.host_id === session?.user.id || distanceKm(coords, { lat: m.lat, lng: m.lng }) <= radius);
    const { upcoming, past } = upcomingThenPast(near);
    // soonest first; distance is shown, and used only as a tiebreaker for same-start games
    const soon = upcoming.map(withDist)
      .sort((a, b) => +new Date(a.m.starts_at) - +new Date(b.m.starts_at) || a.d - b.d);
    // one list row holds `columns` cards: 1 on phones, 2–3 side by side on iPad
    return [
      { title: "", data: rows(soon, columns) },
      { title: t("feed.past"), data: rows(past.map(withDist), columns) },
    ].filter((s) => s.data.length);
  }, [matches, coords, granted, radius, session, columns]);
  const filteredOut = matches.length > 0;   // an empty list with games loaded means the radius hid them all

  return (
    <Screen>
      <SectionList showsVerticalScrollIndicator={false}
        sections={sections}
        keyExtractor={(row) => row[0].m.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}
        refreshControl={
          <RefreshControl tintColor={colors.accent} refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />
        }
        ListHeaderComponent={
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
            <Text style={type.small}>{t(granted ? "feed.near" : "feed.enableLocation")}</Text>
            {granted && <RadiusButton />}
          </View>
        }
        renderSectionHeader={({ section }) => section.title
          ? <Text style={[type.label, { marginTop: space.md, marginBottom: space.sm }]}>{section.title}</Text>
          : null}
        renderItem={({ item: row }) => (
          <View style={{ flexDirection: "row", gap: space.md }}>
            {Array.from({ length: columns }, (_, i) => (
              <View key={row[i]?.m.id ?? i} style={{ flex: 1 }}>
                {row[i] && <MatchCard match={row[i].m} distanceKm={granted ? row[i].d : undefined} fill={columns > 1} />}
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={type.title}>{t(loading ? "feed.loading" : error ? "feed.loadFailed" : filteredOut ? "feed.noneNearby" : "feed.empty")}</Text>
            <Text style={[type.small, { marginTop: space.sm, textAlign: "center" }]}>
              {error ?? (loading ? "" : t(filteredOut ? "feed.noneNearbyHint" : "feed.emptyHint"))}
            </Text>
          </View>
        }
      />
    </Screen>
  );
}
