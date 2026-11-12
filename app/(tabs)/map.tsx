import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/ui";
import { formatPrice, formatWhen, headcountLabel, isPast, useMatches, useUserLocation } from "../../lib/hooks";
import { colors, space, type } from "../../lib/theme";
import { t } from "../../lib/i18n";

export default function MapTab() {
  const { matches } = useMatches();
  const { coords } = useUserLocation();
  const router = useRouter();

  return (
    <Screen>
      <MapView
        style={StyleSheet.absoluteFill}
        region={{ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        showsUserLocation
        userInterfaceStyle="dark"
      >
        {matches.map((m) => (
          <Marker key={m.id} coordinate={{ latitude: m.lat, longitude: m.lng }}
            onCalloutPress={() => router.push({ pathname: "/match/[id]", params: { id: m.id } })}>
            <View style={[styles.pin, { backgroundColor: isPast(m) ? colors.muted : m.is_confirmed ? colors.accent : colors.warning, opacity: isPast(m) ? 0.6 : 1 }]}>
              <Ionicons name="football" size={16} color={colors.accentInk} />
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={type.small}>{formatWhen(m.starts_at)}</Text>
                <Text style={[type.body, { fontWeight: "700" }]} numberOfLines={1}>{m.title}</Text>
                <Text style={type.small}>{isPast(m) ? t("match.played", { count: m.going_count }) : headcountLabel(m).text} · {formatPrice(m.price_cents, m.currency)}</Text>
                <Text style={[type.small, { color: colors.accent, marginTop: 4 }]}>{t("match.tapDetails")}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pin: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  callout: { backgroundColor: colors.surface, borderRadius: 14, padding: space.md, minWidth: 200, borderWidth: 1, borderColor: colors.border },
});
