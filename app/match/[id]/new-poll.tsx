import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field } from "../../../components/ui";
import { DateTimeField } from "../../../components/DateTimeField";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { locationPicker } from "../../../lib/pickerStore";
import { formatWhen } from "../../../lib/hooks";
import { colors, radius, space, type } from "../../../lib/theme";
import type { Place } from "../../../lib/types";

type Kind = "time" | "location";
interface Draft { key: string; label: string; starts_at?: string; place?: Place }

export default function NewPoll() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [kind, setKind] = useState<Kind>("time");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<Draft[]>([]);
  const [when, setWhen] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(18, 0, 0, 0); return d; });
  const [busy, setBusy] = useState(false);

  const addTime = () => {
    if (when.getTime() < Date.now()) { Alert.alert("Pick a future time"); return; }
    const iso = when.toISOString();
    if (options.some((o) => o.starts_at === iso)) return;
    setOptions((o) => [...o, { key: iso, label: formatWhen(iso), starts_at: iso }]);
  };

  const addPlace = () => {
    locationPicker.open((p) => setOptions((o) =>
      o.some((x) => x.place?.id === p.id) ? o : [...o, { key: p.id, label: p.name, place: p }]));
    router.push("/pick-location");
  };

  const submit = async () => {
    if (!session) return;
    if (options.length < 2) { Alert.alert("Add at least two options", "People need something to choose between."); return; }
    setBusy(true);
    const q = question.trim() || (kind === "time" ? "When should we play?" : "Where should we play?");
    const { data: poll, error } = await supabase.from("polls")
      .insert({ match_id: id, kind, question: q, created_by: session.user.id }).select("id").single();
    if (error || !poll) { setBusy(false); Alert.alert("Couldn't create vote", error?.message); return; }

    const { error: optErr } = await supabase.from("poll_options").insert(options.map((o) => ({
      poll_id: poll.id, label: o.label, starts_at: o.starts_at ?? null,
      venue_name: o.place?.name ?? null, lat: o.place?.lat ?? null, lng: o.place?.lng ?? null,
    })));
    setBusy(false);
    if (optErr) { Alert.alert("Couldn't add options", optErr.message); return; }
    router.back();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, marginBottom: space.lg }}>
        {(["time", "location"] as Kind[]).map((k) => (
          <Pressable key={k} onPress={() => { setKind(k); setOptions([]); }}
            style={{ flex: 1, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
              backgroundColor: kind === k ? colors.accent : "transparent" }}>
            <Text style={{ fontWeight: "700", color: kind === k ? colors.accentInk : colors.muted }}>
              {k === "time" ? "Vote on time" : "Vote on place"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field label="Question" value={question} onChangeText={setQuestion}
        placeholder={kind === "time" ? "When should we play?" : "Where should we play?"} />

      <Text style={[type.label, { marginBottom: 6 }]}>Options ({options.length})</Text>
      {options.map((o) => (
        <Card key={o.key} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Ionicons name={kind === "time" ? "time-outline" : "location-outline"} size={18} color={colors.accent} />
          <View style={{ flex: 1, marginLeft: space.sm }}>
            <Text style={type.body} numberOfLines={1}>{o.label}</Text>
            {o.place?.address ? <Text style={type.small} numberOfLines={1}>{o.place.address}</Text> : null}
          </View>
          <Pressable onPress={() => setOptions((x) => x.filter((y) => y.key !== o.key))} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </Card>
      ))}

      <View style={{ marginTop: space.sm }}>
        {kind === "time" ? (
          <>
            <DateTimeField label="Add a time option" value={when} onChange={setWhen} />
            <Button title="Add this time" variant="secondary" icon="add" onPress={addTime} />
          </>
        ) : (
          <Button title="Add a location from the map" variant="secondary" icon="map-outline" onPress={addPlace} />
        )}
      </View>

      <Button title="Start vote" onPress={submit} loading={busy} style={{ marginTop: space.xl }} />
    </ScrollView>
  );
}
