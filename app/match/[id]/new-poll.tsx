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
import { column, widths } from "../../../lib/layout";
import type { Place } from "../../../lib/types";
import { t } from "../../../lib/i18n";

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
    if (when.getTime() < Date.now()) { Alert.alert(t("poll.futureTime")); return; }
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
    if (options.length < 2) { Alert.alert(t("poll.twoOptions"), t("poll.twoOptionsBody")); return; }
    setBusy(true);
    const q = question.trim() || t(kind === "time" ? "poll.when" : "poll.where");
    const { data: poll, error } = await supabase.from("polls")
      .insert({ match_id: id, kind, question: q, created_by: session.user.id }).select("id").single();
    if (error || !poll) { setBusy(false); Alert.alert(t("poll.couldntCreate"), error?.message); return; }

    const { error: optErr } = await supabase.from("poll_options").insert(options.map((o) => ({
      poll_id: poll.id, label: o.label, starts_at: o.starts_at ?? null,
      venue_name: o.place?.name ?? null, lat: o.place?.lat ?? null, lng: o.place?.lng ?? null,
    })));
    setBusy(false);
    if (optErr) { Alert.alert(t("poll.couldntAdd"), optErr.message); return; }
    router.back();
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[{ padding: space.md }, column(widths.form)]} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, marginBottom: space.lg }}>
        {(["time", "location"] as Kind[]).map((k) => (
          <Pressable key={k} onPress={() => { setKind(k); setOptions([]); }}
            style={{ flex: 1, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
              backgroundColor: kind === k ? colors.accent : "transparent" }}>
            <Text style={{ fontWeight: "700", color: kind === k ? colors.accentInk : colors.muted }}>
              {t(k === "time" ? "poll.onTime" : "poll.onPlace")}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field label={t("poll.question")} value={question} onChangeText={setQuestion}
        placeholder={t(kind === "time" ? "poll.when" : "poll.where")} />

      <Text style={[type.label, { marginBottom: 6 }]}>{t("poll.options", { count: options.length })}</Text>
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
            <DateTimeField label={t("poll.addTimeLabel")} value={when} onChange={setWhen} />
            <Button title={t("poll.addTime")} variant="secondary" icon="add" onPress={addTime} />
          </>
        ) : (
          <Button title={t("poll.addPlace")} variant="secondary" icon="map-outline" onPress={addPlace} />
        )}
      </View>

      <Button title={t("poll.start")} onPress={submit} loading={busy} style={{ marginTop: space.xl }} />
    </ScrollView>
  );
}
