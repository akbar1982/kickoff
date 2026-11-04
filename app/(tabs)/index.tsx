import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Screen } from "../../components/ui";
import { MatchCard } from "../../components/MatchCard";
import { upcomingThenPast, useMatches, useUserLocation } from "../../lib/hooks";
import { distanceKm } from "../../lib/places";
import { colors, space, type } from "../../lib/theme";

export default function Feed() {
  const { matches, loading, error, reload } = useMatches();
  const { coords, granted } = useUserLocation();
  const [refreshing, setRefreshing] = useState(false);

  const sorted = useMemo(() => {
    const dist = (m: (typeof matches)[number]) => distanceKm(coords, { lat: m.lat, lng: m.lng });
    const { upcoming, past } = upcomingThenPast(matches);
    // soonest first; distance is shown, and used only as a tiebreaker for same-start games
    const soon = upcoming.map((m) => ({ m, d: dist(m) }))
      .sort((a, b) => +new Date(a.m.starts_at) - +new Date(b.m.starts_at) || a.d - b.d);
    return { items: [...soon, ...past.map((m) => ({ m, d: dist(m) }))], firstPast: past[0]?.id };
  }, [matches, coords]);

  return (
    <Screen>
      <FlatList
        data={sorted.items}
        keyExtractor={(x) => x.m.id}
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
        renderItem={({ item }) => (
          <>
            {item.m.id === sorted.firstPast && <Text style={[type.label, { marginTop: space.md, marginBottom: space.sm }]}>Past games</Text>}
            <MatchCard match={item.m} distanceKm={granted ? item.d : undefined} />
          </>
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
