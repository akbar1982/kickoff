import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip, PlayerMeter } from "./ui";
import { formatPrice, formatWhen, headcountLabel, isPast } from "../lib/hooks";
import { colors, space, type } from "../lib/theme";
import type { Match } from "../lib/types";

/** `fill` stretches the card to its grid cell, so cards in one row line up. */
export function MatchCard({ match, distanceKm, fill }: { match: Match; distanceKm?: number; fill?: boolean }) {
  const router = useRouter();
  const head = headcountLabel(match);
  const past = isPast(match);
  return (
    <Pressable onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
      style={({ pressed }) => ({ opacity: (past ? 0.5 : 1) * (pressed ? 0.9 : 1), marginBottom: space.md, flex: fill ? 1 : undefined })}>
      <Card style={fill ? { flex: 1 } : undefined}>
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
          {past
            ? <Chip label={`Played · ${match.going_count} player${match.going_count === 1 ? "" : "s"}`} icon="time" />
            : <Chip label={head.text} tone={head.tone} icon={match.is_confirmed ? "checkmark-circle" : "people"} />}
          {match.group_name && <Chip label={match.group_name} icon="shield" />}
          {match.visibility === "group" && <Chip label="Members only" icon="lock-closed" />}
        </View>
      </Card>
    </Pressable>
  );
}
