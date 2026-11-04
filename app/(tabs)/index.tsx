import React, { useMemo, useState } from "react";
import { RefreshControl, SectionList, Text, View } from "react-native";
import { Screen } from "../../components/ui";
import { MatchCard } from "../../components/MatchCard";
import { upcomingThenPast, useMatches, useUserLocation } from "../../lib/hooks";
import { distanceKm } from "../../lib/places";
import { colors, space, type } from "../../lib/theme";
import { rows, useLayout } from "../../lib/layout";

export default function Feed() {
  const { matches, loading, error, reload } = useMatches();
  const { coords, granted } = useUserLocation();
  const { columns } = useLayout();
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const withDist = (m: (typeof matches)[number]) => ({ m, d: distanceKm(coords, { lat: m.lat, lng: m.lng }) });
    const { upcoming, past } = upcomingThenPast(matches);
    // soonest first; distance is shown, and used only as a tiebreaker for same-start games
    const soon = upcoming.map(withDist)
      .sort((a, b) => +new Date(a.m.starts_at) - +new Date(b.m.starts_at) || a.d - b.d);
    // one list row holds `columns` cards: 1 on phones, 2–3 side by side on iPad
    return [
      { title: "", data: rows(soon, columns) },
      { title: "Past games", data: rows(past.map(withDist), columns) },
    ].filter((s) => s.data.length);
  }, [matches, coords, columns]);

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
          <Text style={[type.small, { marginBottom: space.md }]}>
            {granted ? "Games near you" : "Enable location to see distances"}
          </Text>
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
            <Text style={type.title}>{loading ? "Loading games…" : error ? "Couldn't load games" : "No games yet"}</Text>
            <Text style={[type.small, { marginTop: space.sm, textAlign: "center" }]}>
              {error ?? (loading ? "" : "Join a group to see its games, or start your own and tap + to post one.")}
            </Text>
          </View>
        }
      />
    </Screen>
  );
}
