import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip, PlayerMeter } from "./ui";
import { formatPrice, formatWhen, headcountLabel } from "../lib/hooks";
import { colors, space, type } from "../lib/theme";
import type { Match } from "../lib/types";

export function MatchCard({ match, distanceKm }: { match: Match; distanceKm?: number }) {
  const router = useRouter();
  const head = headcountLabel(match);
  return (
    <Pressable onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, marginBottom: space.md })}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: space.sm }}>
            <Text style={type.small}>{formatWhen(match.starts_at)}</Text>
            <Text style={[type.title, { marginTop: 2 }]} numberOfLines={1}>{match.title}</Text>
          </View>
          <Chip label={formatPrice(match.price_cents, match.currency)} tone={match.price_cents > 0 ? "neutral" : "good"} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: space.sm }}>
          <Ionicons name="location-outline" size={15} color={colors.muted} />
          <Text style={[type.small, { marginLeft: 4, flex: 1 }]} numberOfLines={1}>
            {match.venue_name}{distanceKm !== undefined ? ` · ${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km` : ""}
          </Text>
        </View>

        <View style={{ marginTop: space.md }}>
          <PlayerMeter going={match.going_count} min={match.min_players} max={match.max_players} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.md }}>
          <Chip label={head.text} tone={head.tone} icon={match.is_confirmed ? "checkmark-circle" : "people"} />
          {match.group_name && <Chip label={match.group_name} icon="shield" />}
          {match.visibility === "group" && <Chip label="Members only" icon="lock-closed" />}
        </View>
      </Card>
    </Pressable>
  );
}
