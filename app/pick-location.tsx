import React, { useEffect, useRef, useState } from "react";
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Region } from "react-native-maps";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Screen } from "../components/ui";
import { useUserLocation } from "../lib/hooks";
import { describePin, searchPlaces } from "../lib/places";
import { locationPicker } from "../lib/pickerStore";
import { colors, radius, space, type } from "../lib/theme";
import { column, widths } from "../lib/layout";
import type { Place } from "../lib/types";
import { t } from "../lib/i18n";

export default function PickLocation() {
  const router = useRouter();
  const { coords } = useUserLocation();
  const map = useRef<MapView>(null);
  const [center, setCenter] = useState(coords);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setCenter(coords);
    map.current?.animateToRegion({ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 400);
  }, [coords.lat, coords.lng]);

  // debounce the venue search
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchPlaces(query, center)); } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = (p: Place) => { locationPicker.resolve(p); router.back(); };

  const pickResult = (p: Place) => {
    Keyboard.dismiss();
    setResults([]);
    setQuery(p.name);
    map.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
    setCenter({ lat: p.lat, lng: p.lng });
  };

  const usePin = async () => {
    const d = await describePin(center.lat, center.lng);
    choose({ id: `pin-${center.lat},${center.lng}`, name: d.name, address: d.address, lat: center.lat, lng: center.lng });
  };

  const onRegionDone = (r: Region) => setCenter({ lat: r.latitude, lng: r.longitude });

  return (
    <Screen>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        showsUserLocation
        onRegionChangeComplete={onRegionDone}
        userInterfaceStyle="dark"
      />

      {/* fixed centre pin: the map moves under it */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <Ionicons name="location-sharp" size={44} color={colors.accent} style={{ marginBottom: 22 }} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("pick.search")}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searching && <Text style={type.small}>…</Text>}
        </View>
        {results.length > 0 && (
          <FlatList showsVerticalScrollIndicator={false}
            style={styles.results}
            keyboardShouldPersistTaps="handled"
            data={results}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => pickResult(item)}>
                <Ionicons name="football-outline" size={18} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={type.body} numberOfLines={1}>{item.name}</Text>
                  <Text style={type.small} numberOfLines={1}>{item.address}</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Button title={t("pick.use")} onPress={usePin} style={column(widths.form)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pinWrap: { ...(StyleSheet.absoluteFill as object), alignItems: "center", justifyContent: "center" },
  searchWrap: { position: "absolute", top: space.md, left: space.md, right: space.md, alignItems: "center" },
  searchBox: {
    width: "100%", maxWidth: widths.form, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md, height: 50,
  },
  searchInput: { flex: 1, color: colors.text, marginLeft: space.sm, fontSize: 15 },
  results: {
    width: "100%", maxWidth: widths.form, marginTop: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, maxHeight: 280,
    borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  footer: { position: "absolute", bottom: space.lg, left: space.md, right: space.md },
});
