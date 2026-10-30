import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, Card, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { formatWhen } from "../../lib/hooks";
import { usePayouts } from "../../lib/payments";
import { deleteAccount, openLegal } from "../../lib/safety";
import { colors, space, type } from "../../lib/theme";

interface Mine {
  match_id: string; status: string; paid_at: string | null;
  matches: { title: string; starts_at: string; status: string; price_cents: number; payment_method: string };
}

function chip(r: Mine): { label: string; tone: "good" | "warn" | "accent" } {
  if (r.matches.status === "cancelled") return { label: "Cancelled", tone: "warn" };
  if (r.status === "waitlist") return { label: "Waitlist", tone: "accent" };
  if (r.status === "pending_payment") return { label: "Payment due", tone: "accent" };
  const owesOrganizer = r.matches.price_cents > 0 && r.matches.payment_method === "direct" && !r.paid_at;
  return owesOrganizer ? { label: "You're in · pay organizer", tone: "warn" } : { label: "You're in", tone: "good" };
}

export default function Profile() {
  const { session, role, signOut } = useAuth();
  const router = useRouter();
  const [mine, setMine] = useState<Mine[]>([]);
  const payouts = usePayouts();
  const tryIt = (fn: () => Promise<void>) => fn().catch((e) => Alert.alert("Payouts", e?.message ?? "Something went wrong."));
  const meta = session?.user.user_metadata ?? {};
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => Alert.alert(
    "Delete your account?",
    "This permanently deletes your profile, messages, RSVPs and the games you host. Groups you organize pass to another member. This can't be undone.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setDeleting(true);
        try {
          await deleteAccount();
          await signOut();
        } catch (e: any) {
          Alert.alert("Couldn't delete account", e?.message ?? "Please try again.");
        } finally {
          setDeleting(false);
        }
      } },
    ],
  );
  const name: string = meta.full_name ?? meta.name ?? session?.user.email ?? "Player";

  useFocusEffect(useCallback(() => {
    if (!session) return;
    supabase.from("rsvps").select("match_id,status,paid_at,matches(title,starts_at,status,price_cents,payment_method)")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        const rows = ((data ?? []) as unknown as Mine[])
          .filter((r) => r.matches && new Date(r.matches.starts_at) > new Date())
          .sort((a, b) => +new Date(a.matches.starts_at) - +new Date(b.matches.starts_at));
        setMine(rows);
      });
  }, [session]));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.md }}>
      <View style={{ alignItems: "center", marginVertical: space.lg }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 36, fontWeight: "800", color: colors.accentInk }}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={[type.title, { marginTop: space.md }]}>{name}</Text>
        <Text style={type.small}>{session?.user.email}</Text>
        {role === "admin" && (
          <View style={{ marginTop: space.sm }}>
            <Chip label="Admin" tone="accent" />
          </View>
        )}
      </View>

      <Text style={[type.label, { marginBottom: space.sm }]}>Your upcoming games</Text>
      {mine.length === 0 && <Text style={[type.small, { marginBottom: space.md }]}>You haven't joined any games yet.</Text>}
      {mine.map((r) => (
        <Card key={r.match_id} style={{ marginBottom: space.sm }}>
          <Text style={type.small}>{formatWhen(r.matches.starts_at)}</Text>
          <Text style={[type.body, { fontWeight: "700", marginVertical: 4 }]}
            onPress={() => router.push({ pathname: "/match/[id]", params: { id: r.match_id } })}>{r.matches.title}</Text>
          <View style={{ flexDirection: "row" }}>
            <Chip label={chip(r).label} tone={chip(r).tone} />
          </View>
        </Card>
      ))}

      <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>Payouts</Text>
      <Card>
        {!payouts.status ? <Text style={type.small}>Loading…</Text> : payouts.ready ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Chip label="Payouts active" tone="good" icon="checkmark-circle" />
            </View>
            <Text style={[type.small, { marginTop: space.sm }]}>
              {payouts.status.payouts_enabled
                ? "Players' payments for games you host go to your Stripe account and are paid out to your bank or debit card."
                : "You can post paid games. Add a bank account or debit card in Stripe so the money can be paid out to you."}
            </Text>
            <Button title={payouts.status.payouts_enabled ? "View payouts" : "Add bank or debit card"} variant="secondary" icon="wallet"
              style={{ marginTop: space.md }}
              onPress={() => tryIt(payouts.status!.payouts_enabled ? payouts.openDashboard : payouts.setUp)} loading={payouts.busy} />
          </>
        ) : (
          <>
            <Text style={type.body}>{payouts.status.details_submitted ? "Stripe is checking your details" : "Get paid for the games you host"}</Text>
            <Text style={[type.small, { marginTop: 4 }]}>
              {payouts.status.details_submitted
                ? "This usually takes a few minutes. If Stripe needs anything else, tap below to finish."
                : "Set up payouts with Stripe to post paid games. Players' payments go straight to your bank account or debit card."}
            </Text>
            <Button title={payouts.status.details_submitted ? "Finish setup" : "Set up payouts"} icon="card"
              style={{ marginTop: space.md }} onPress={() => tryIt(payouts.setUp)} loading={payouts.busy} />
          </>
        )}
      </Card>

      {role === "admin" && (
        <>
          <Text style={[type.label, { marginTop: space.xl, marginBottom: space.sm }]}>Admin</Text>
          <View style={{ gap: space.sm }}>
            <Button title="Reports" icon="flag" variant="secondary" onPress={() => router.push("/reports")} />
            <Button title="Manage users" icon="people" variant="secondary" onPress={() => router.push("/admin")} />
          </View>
        </>
      )}

      <Text style={[type.label, { marginTop: space.xl, marginBottom: space.sm }]}>Account</Text>
      <Card style={{ paddingVertical: 0 }}>
        {([
          ["Blocked users", "ban", () => router.push("/blocked")],
          ["Help & support", "help-circle", () => openLegal("support")],
          ["Terms of Use", "document-text", () => openLegal("terms")],
          ["Privacy Policy", "lock-closed", () => openLegal("privacy")],
        ] as const).map(([label, icon, onPress], i) => (
          <Pressable key={label} onPress={onPress} style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", paddingVertical: 14, opacity: pressed ? 0.6 : 1,
            borderTopWidth: i ? 1 : 0, borderTopColor: colors.border })}>
            <Ionicons name={icon} size={20} color={colors.muted} />
            <Text style={[type.body, { flex: 1, marginLeft: space.md }]}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        <Button title="Sign out" variant="secondary" onPress={() =>
          Alert.alert("Sign out?", undefined, [{ text: "Cancel", style: "cancel" }, { text: "Sign out", onPress: signOut }])} />
        <Button title="Delete account" variant="danger" loading={deleting} onPress={confirmDelete} />
      </View>
        </ScrollView>
  );
}
