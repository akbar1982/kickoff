import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Screen } from "../../components/ui";
import { MatchCard } from "../../components/MatchCard";
import { useUpcomingMatches, useUserLocation } from "../../lib/hooks";
import { distanceKm } from "../../lib/places";
import { colors, space, type } from "../../lib/theme";

export default function Feed() {
  const { matches, loading, error, reload } = useUpcomingMatches();
  const { coords, granted } = useUserLocation();
  const [refreshing, setRefreshing] = useState(false);

  const sorted = useMemo(() => {
    const withDist = matches.map((m) => ({ m, d: distanceKm(coords, { lat: m.lat, lng: m.lng }) }));
    // soonest first; distance is shown, and used only as a tiebreaker for same-start games
    return withDist.sort((a, b) => +new Date(a.m.starts_at) - +new Date(b.m.starts_at) || a.d - b.d);
  }, [matches, coords]);

  return (
    <Screen>
      <FlatList
        data={sorted}
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
        renderItem={({ item }) => <MatchCard match={item.m} distanceKm={granted ? item.d : undefined} />}
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
