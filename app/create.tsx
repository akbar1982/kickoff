import React, { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field, Stepper } from "../components/ui";
import { useAuth } from "../lib/auth";
import { DateTimeField } from "../components/DateTimeField";
import { supabase } from "../lib/supabase";
import { locationPicker } from "../lib/pickerStore";
import { usePayouts } from "../lib/payments";
import { formatPrice } from "../lib/hooks";
import { platformFeeCents, stripeFeeCents } from "../lib/fee";
import { colors, space, type } from "../lib/theme";
import { column, widths } from "../lib/layout";
import type { Group, Place } from "../lib/types";
import { t } from "../lib/i18n";

const MIN_ALLOWED = 2;
const MAX_ALLOWED = 60;

/** Organizer's share of a price typed as dollars, after Stripe's card fee and Kickoff's fee. */
function takeHome(price: string) {
  const cents = Math.round(parseFloat(price.replace(",", ".")) * 100);
  if (!isFinite(cents) || cents < 100) return null;
  return cents - stripeFeeCents(cents) - platformFeeCents(cents);
}

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

export default function CreateMatch() {
  const router = useRouter();
  const { session, role } = useAuth();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const [groups, setGroups] = useState<Group[] | null>(null);    // groups I can post in
  const [groupId, setGroupId] = useState<string | undefined>(params.groupId);
  const [openToAll, setOpenToAll] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [duration, setDuration] = useState(90);
  const [minPlayers, setMinPlayers] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState(14);
  const [paid, setPaid] = useState(false);
  const payouts = usePayouts();
  const [method, setMethod] = useState<"stripe" | "direct">("stripe");
  const [instructions, setInstructions] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let q = supabase.from("group_overview").select("*").order("name");
    if (role !== "admin") q = q.eq("my_status", "active").eq("my_group_role", "organizer");
    q.then(({ data }) => {
      const list = (data ?? []) as Group[];
      setGroups(list);
      setGroupId((cur) => cur ?? (list.length === 1 ? list[0].id : undefined));
    });
  }, [role]);

  // Keep min <= max no matter which stepper the host touches.
  const changeMin = (n: number) => { setMinPlayers(n); if (n > maxPlayers) setMaxPlayers(n); };
  const changeMax = (n: number) => { setMaxPlayers(n); if (n < minPlayers) setMinPlayers(n); };

  const pickLocation = () => {
    locationPicker.open(setPlace);
    router.push("/pick-location");
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 3) e.title = t("create.errTitle");
    if (!groupId) e.group = t("create.errGroup");
    if (!place) e.place = t("create.errPlace");
    if (startsAt.getTime() < Date.now() + 5 * 60_000) e.when = t("create.errWhen");
    const cents = Math.round(parseFloat(price.replace(",", ".")) * 100);
    if (paid && (!isFinite(cents) || cents < 100)) e.price = t("create.errPrice");
    if (paid && method === "stripe" && !payouts.ready) e.method = t("create.errPayouts");
    if (paid && method === "direct" && !instructions.trim()) e.method = t("create.errInstructions");
    setErrors(e);
    if (Object.keys(e).length || !session || !place) return;

    setBusy(true);
    const { data, error } = await supabase.from("matches").insert({
      host_id: session.user.id,
      group_id: groupId,
      visibility: openToAll ? "public" : "group",
      title: title.trim(),
      description: description.trim() || null,
      venue_name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      starts_at: startsAt.toISOString(),
      duration_min: duration,
      min_players: minPlayers,
      max_players: maxPlayers,
      price_cents: paid ? cents : 0,
      payment_method: method,
      payment_instructions: paid && method === "direct" ? instructions.trim() : null,
    }).select("id").single();
    setBusy(false);

    if (error) { Alert.alert(t("create.failed"), error.message); return; }
    router.replace({ pathname: "/match/[id]", params: { id: data.id } });
  };

  if (groups && groups.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: space.lg }}>
        <Ionicons name="people-outline" size={40} color={colors.muted} />
        <Text style={[type.title, { marginTop: space.md }]}>{t("create.groupFirst")}</Text>
        <Text style={[type.small, { marginTop: space.sm, marginBottom: space.lg, textAlign: "center", maxWidth: 420 }]}>
          {t("create.groupFirstBody")}
        </Text>
        <Button title={t("create.startGroup")} icon="add" onPress={() => router.replace("/group/new")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[{ padding: space.md, paddingBottom: 120 }, column(widths.form)]} keyboardShouldPersistTaps="handled">
        <Text style={[type.label, { marginBottom: 6 }]}>{t("create.group")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: errors.group ? 4 : space.md }}>
          {(groups ?? []).map((g) => {
            const on = g.id === groupId;
            return (
              <Pressable key={g.id} onPress={() => setGroupId(g.id)}
                style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1,
                  borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : colors.surface }}>
                <Text style={{ fontWeight: "700", color: on ? colors.accentInk : colors.text }}>{g.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.group ? <Text style={{ color: colors.danger, fontSize: 12, marginBottom: space.md }}>{errors.group}</Text> : null}

        <Card style={{ marginBottom: space.md, flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>{t("create.openToAll")}</Text>
            <Text style={type.small}>{t(openToAll ? "create.openYes" : "create.openNo")}</Text>
          </View>
          <Switch value={openToAll} onValueChange={setOpenToAll}
            trackColor={{ true: colors.accent, false: colors.surfaceHi }} thumbColor="#fff" />
        </Card>

        <Field label={t("create.name")} value={title} onChangeText={setTitle} error={errors.title}
          placeholder={t("create.namePlaceholder")} maxLength={80} />

        <Text style={[type.label, { marginBottom: 6 }]}>{t("create.location")}</Text>
        <Pressable onPress={pickLocation}>
          <Card style={{ flexDirection: "row", alignItems: "center", marginBottom: errors.place ? 4 : space.md,
            borderColor: errors.place ? colors.danger : colors.border }}>
            <Ionicons name="location" size={22} color={place ? colors.accent : colors.muted} />
            <View style={{ flex: 1, marginLeft: space.sm }}>
              <Text style={type.body} numberOfLines={1}>{place ? place.name : t("create.locationPlaceholder")}</Text>
              {place?.address ? <Text style={type.small} numberOfLines={1}>{place.address}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        </Pressable>
        {errors.place ? <Text style={{ color: colors.danger, fontSize: 12, marginBottom: space.md }}>{errors.place}</Text> : null}

        <DateTimeField label={t("create.kickoff")} value={startsAt} onChange={setStartsAt} />
        {errors.when ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: -8, marginBottom: space.md }}>{errors.when}</Text> : null}

        <Card style={{ marginBottom: space.md }}>
          <Text style={[type.label, { marginBottom: 4 }]}>{t("create.squad")}</Text>
          <Stepper label={t("create.minPlayers")} hint={t("create.minHint")}
            value={minPlayers} min={MIN_ALLOWED} max={MAX_ALLOWED} onChange={changeMin} />
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <Stepper label={t("create.maxPlayers")} hint={t("create.maxHint")}
            value={maxPlayers} min={MIN_ALLOWED} max={MAX_ALLOWED} onChange={changeMax} />
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <Stepper label={t("create.duration")} value={duration} min={30} max={180} onChange={(n) => setDuration(n)} />
        </Card>

        <Card style={{ marginBottom: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{t("create.paid")}</Text>
              <Text style={type.small}>{t("create.paidHint")}</Text>
            </View>
            <Switch value={paid} onValueChange={setPaid}
              trackColor={{ true: colors.accent, false: colors.surfaceHi }} thumbColor="#fff" />
          </View>
          {paid && (
            <View style={{ marginTop: space.md }}>
              <Field label={t("create.price")} value={price} onChangeText={setPrice}
                keyboardType="decimal-pad" placeholder="5.00" error={errors.price} />

              <Text style={[type.label, { marginBottom: 6 }]}>{t("create.howPay")}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: space.md }}>
                {([
                  { value: "stripe", label: t("create.inApp"), hint: t("create.inAppHint") },
                  { value: "direct", label: t("create.direct"), hint: t("create.directHint") },
                ] as const).map((o) => {
                  const on = method === o.value;
                  return (
                    <Pressable key={o.value} onPress={() => setMethod(o.value)}
                      style={{ flex: 1, padding: 12, borderRadius: 14, borderWidth: 1,
                        borderColor: on ? colors.accent : colors.border, backgroundColor: on ? "rgba(198,244,50,0.10)" : colors.surfaceHi }}>
                      <Text style={{ color: on ? colors.accent : colors.text, fontWeight: "700" }}>{o.label}</Text>
                      <Text style={[type.small, { marginTop: 2 }]}>{o.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {method === "stripe" && payouts.ready && takeHome(price) !== null && (
                <Text style={type.small}>
                  {t("create.takeHome", { amount: formatPrice(takeHome(price)!) })}
                </Text>
              )}
              {method === "stripe" && !payouts.ready && (
                <>
                  <Text style={type.small}>
                    {payouts.status?.details_submitted
                      ? t("create.stripeChecking")
                      : t("create.connectStripe")}
                  </Text>
                  <Button title={t(payouts.status?.details_submitted ? "create.finishPayouts" : "create.setUpPayouts")} icon="card" variant="secondary"
                    style={{ marginTop: space.md }} loading={payouts.busy}
                    onPress={() => payouts.setUp().catch((e) => Alert.alert(t("create.payouts"), e?.message ?? t("common.somethingWrongDot")))} />
                  {errors.method ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{errors.method}</Text> : null}
                </>
              )}
              {method === "direct" && (
                <>
                  <Field label={t("create.howToPayYou")} value={instructions} onChangeText={setInstructions} error={errors.method}
                    placeholder={t("create.instructionsPlaceholder")} maxLength={300} multiline
                    style={{ height: 76, paddingTop: 14, textAlignVertical: "top" }} />
                  <Text style={[type.small, { marginTop: -8 }]}>
                    {t("create.directNote")}
                  </Text>
                </>
              )}
            </View>
          )}
        </Card>

        <Field label={t("create.notes")} value={description} onChangeText={setDescription} multiline
          placeholder={t("create.notesPlaceholder")}
          style={{ height: 96, paddingTop: 14, textAlignVertical: "top" }} />

        <Button title={t("create.publish")} icon="checkmark-circle" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
