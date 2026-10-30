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
import { colors, space, type } from "../lib/theme";
import type { Group, Place } from "../lib/types";

const MIN_ALLOWED = 2;
const MAX_ALLOWED = 60;

/** Organizer's share of a price typed as dollars, after Stripe's US card fee (charged to their own Stripe account).
 *  If PLATFORM_FEE_PERCENT is set on the server, subtract that here too. */
function takeHome(price: string) {
  const cents = Math.round(parseFloat(price.replace(",", ".")) * 100);
  if (!isFinite(cents) || cents < 100) return null;
  return cents - (Math.ceil(cents * 0.029) + 30);
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
    if (title.trim().length < 3) e.title = "Give the game a name (3+ characters)";
    if (!groupId) e.group = "Choose which group is hosting";
    if (!place) e.place = "Choose where it's happening";
    if (startsAt.getTime() < Date.now() + 5 * 60_000) e.when = "Pick a time in the future";
    const cents = Math.round(parseFloat(price.replace(",", ".")) * 100);
    if (paid && (!isFinite(cents) || cents < 100)) e.price = "Enter a price of at least 1.00";
    if (paid && method === "stripe" && !payouts.ready) e.method = "Set up payouts first, or let players pay you directly";
    if (paid && method === "direct" && !instructions.trim()) e.method = "Tell players how to pay you";
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

    if (error) { Alert.alert("Couldn't create game", error.message); return; }
    router.replace({ pathname: "/match/[id]", params: { id: data.id } });
  };

  if (groups && groups.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: space.lg }}>
        <Ionicons name="people-outline" size={40} color={colors.muted} />
        <Text style={[type.title, { marginTop: space.md }]}>Start a group first</Text>
        <Text style={[type.small, { marginTop: space.sm, marginBottom: space.lg, textAlign: "center" }]}>
          Games are posted by group organizers. Start your own group and you'll be its organizer.
        </Text>
        <Button title="Start a group" icon="add" onPress={() => router.replace("/group/new")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={[type.label, { marginBottom: 6 }]}>Group</Text>
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
            <Text style={type.body}>Open to everyone</Text>
            <Text style={type.small}>{openToAll ? "Anyone in Kickoff can see and join" : "Only group members can see and join"}</Text>
          </View>
          <Switch value={openToAll} onValueChange={setOpenToAll}
            trackColor={{ true: colors.accent, false: colors.surfaceHi }} thumbColor="#fff" />
        </Card>

        <Field label="Game name" value={title} onChangeText={setTitle} error={errors.title}
          placeholder="Thursday 7-a-side" maxLength={80} />

        <Text style={[type.label, { marginBottom: 6 }]}>Location</Text>
        <Pressable onPress={pickLocation}>
          <Card style={{ flexDirection: "row", alignItems: "center", marginBottom: errors.place ? 4 : space.md,
            borderColor: errors.place ? colors.danger : colors.border }}>
            <Ionicons name="location" size={22} color={place ? colors.accent : colors.muted} />
            <View style={{ flex: 1, marginLeft: space.sm }}>
              <Text style={type.body} numberOfLines={1}>{place ? place.name : "Search or drop a pin on the map"}</Text>
              {place?.address ? <Text style={type.small} numberOfLines={1}>{place.address}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        </Pressable>
        {errors.place ? <Text style={{ color: colors.danger, fontSize: 12, marginBottom: space.md }}>{errors.place}</Text> : null}

        <DateTimeField label="Kick-off" value={startsAt} onChange={setStartsAt} />
        {errors.when ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: -8, marginBottom: space.md }}>{errors.when}</Text> : null}

        <Card style={{ marginBottom: space.md }}>
          <Text style={[type.label, { marginBottom: 4 }]}>Squad size</Text>
          <Stepper label="Minimum players" hint="Game is confirmed once this many have joined"
            value={minPlayers} min={MIN_ALLOWED} max={MAX_ALLOWED} onChange={changeMin} />
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <Stepper label="Maximum players" hint="Extra sign-ups go on a waitlist"
            value={maxPlayers} min={MIN_ALLOWED} max={MAX_ALLOWED} onChange={changeMax} />
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <Stepper label="Duration (minutes)" value={duration} min={30} max={180} onChange={(n) => setDuration(n)} />
        </Card>

        <Card style={{ marginBottom: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>Paid game</Text>
              <Text style={type.small}>Players pay in the app, or straight to you</Text>
            </View>
            <Switch value={paid} onValueChange={setPaid}
              trackColor={{ true: colors.accent, false: colors.surfaceHi }} thumbColor="#fff" />
          </View>
          {paid && (
            <View style={{ marginTop: space.md }}>
              <Field label="Price per player (USD)" value={price} onChangeText={setPrice}
                keyboardType="decimal-pad" placeholder="5.00" error={errors.price} />

              <Text style={[type.label, { marginBottom: 6 }]}>How players pay</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: space.md }}>
                {([
                  { value: "stripe", label: "In the app", hint: "Card, Apple Pay, Google Pay" },
                  { value: "direct", label: "Pay me directly", hint: "Venmo, Zelle, cash" },
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
                  You receive about {formatPrice(takeHome(price)!)} per player. Stripe's card fee (2.9% + 30¢) comes out of your Stripe account.
                </Text>
              )}
              {method === "stripe" && !payouts.ready && (
                <>
                  <Text style={type.small}>
                    {payouts.status?.details_submitted
                      ? "Stripe is still checking your payout details. Finish setup to take payments in the app."
                      : "To take payments in the app, connect a bank account or debit card through Stripe. It takes about 5 minutes."}
                  </Text>
                  <Button title={payouts.status?.details_submitted ? "Finish payout setup" : "Set up payouts"} icon="card" variant="secondary"
                    style={{ marginTop: space.md }} loading={payouts.busy}
                    onPress={() => payouts.setUp().catch((e) => Alert.alert("Payouts", e?.message ?? "Something went wrong."))} />
                  {errors.method ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{errors.method}</Text> : null}
                </>
              )}
              {method === "direct" && (
                <>
                  <Field label="How to pay you" value={instructions} onChangeText={setInstructions} error={errors.method}
                    placeholder="Venmo @your-business, Zelle 555-123-4567, or cash at the field" maxLength={300} multiline
                    style={{ height: 76, paddingTop: 14, textAlignVertical: "top" }} />
                  <Text style={[type.small, { marginTop: -8 }]}>
                    Players get their spot when they join. Mark them paid on the game page, and remove anyone who doesn't pay.
                  </Text>
                </>
              )}
            </View>
          )}
        </Card>

        <Field label="Notes (optional)" value={description} onChangeText={setDescription} multiline
          placeholder="Bring both a light and a dark shirt. Turf shoes only."
          style={{ height: 96, paddingTop: 14, textAlignVertical: "top" }} />

        <Button title="Publish game" icon="checkmark-circle" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
