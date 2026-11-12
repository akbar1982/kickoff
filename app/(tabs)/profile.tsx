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
import { column, widths } from "../../lib/layout";
import { langChoice, languages, setLanguage, t } from "../../lib/i18n";
import { showSheet } from "../../components/ActionSheet";

interface Mine {
  match_id: string; status: string; paid_at: string | null;
  matches: { title: string; starts_at: string; status: string; price_cents: number; payment_method: string };
}

function chip(r: Mine): { label: string; tone: "good" | "warn" | "accent" } {
  if (r.matches.status === "cancelled") return { label: t("common.cancelled"), tone: "warn" };
  if (r.status === "waitlist") return { label: t("profile.waitlist"), tone: "accent" };
  if (r.status === "pending_payment") return { label: t("common.paymentDue"), tone: "accent" };
  const owesOrganizer = r.matches.price_cents > 0 && r.matches.payment_method === "direct" && !r.paid_at;
  return owesOrganizer ? { label: t("profile.inPayOrganizer"), tone: "warn" } : { label: t("profile.in"), tone: "good" };
}

export default function Profile() {
  const { session, role, signOut } = useAuth();
  const router = useRouter();
  const [mine, setMine] = useState<Mine[]>([]);
  const payouts = usePayouts();
  const tryIt = (fn: () => Promise<void>) => fn().catch((e) => Alert.alert(t("profile.payouts"), e?.message ?? t("common.somethingWrongDot")));
  const meta = session?.user.user_metadata ?? {};
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => Alert.alert(
    t("profile.deleteTitle"),
    t("profile.deleteBody"),
    [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: async () => {
        setDeleting(true);
        try {
          await deleteAccount();
          await signOut();
        } catch (e: any) {
          Alert.alert(t("profile.deleteFailed"), e?.message ?? t("common.tryAgain"));
        } finally {
          setDeleting(false);
        }
      } },
    ],
  );
  // Phone language, or one picked here (remembered on this device).
  const pickLanguage = () => showSheet({
    title: t("profile.language"),
    options: [
      { label: t("profile.languageSystem"), onPress: () => setLanguage(null) },
      ...languages.map((l) => ({ label: l.name, onPress: () => setLanguage(l.code) })),
    ],
  });
  const name: string = meta.full_name ?? meta.name ?? session?.user.email ?? t("common.player");

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
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[{ padding: space.md }, column(widths.page)]}>
      <View style={{ alignItems: "center", marginVertical: space.lg }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 36, fontWeight: "800", color: colors.accentInk }}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={[type.title, { marginTop: space.md }]}>{name}</Text>
        <Text style={type.small}>{session?.user.email}</Text>
        {role === "admin" && (
          <View style={{ marginTop: space.sm }}>
            <Chip label={t("common.admin")} tone="accent" />
          </View>
        )}
      </View>

      <Text style={[type.label, { marginBottom: space.sm }]}>{t("profile.upcoming")}</Text>
      {mine.length === 0 && <Text style={[type.small, { marginBottom: space.md }]}>{t("profile.noGames")}</Text>}
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

      <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>{t("profile.payouts")}</Text>
      <Card>
        {!payouts.status ? <Text style={type.small}>{t("common.loading")}</Text> : payouts.ready ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Chip label={t("profile.payoutsActive")} tone="good" icon="checkmark-circle" />
            </View>
            <Text style={[type.small, { marginTop: space.sm }]}>
              {payouts.status.payouts_enabled
                ? t("profile.payoutsEnabled")
                : t("profile.payoutsNoBank")}
            </Text>
            <Button title={t(payouts.status.payouts_enabled ? "profile.viewPayouts" : "profile.addBank")} variant="secondary" icon="wallet"
              style={{ marginTop: space.md }}
              onPress={() => tryIt(payouts.status!.payouts_enabled ? payouts.openDashboard : payouts.setUp)} loading={payouts.busy} />
          </>
        ) : (
          <>
            <Text style={type.body}>{t(payouts.status.details_submitted ? "profile.stripeChecking" : "profile.getPaid")}</Text>
            <Text style={[type.small, { marginTop: 4 }]}>
              {payouts.status.details_submitted
                ? t("profile.checkingBody")
                : t("profile.getPaidBody")}
            </Text>
            <Button title={t(payouts.status.details_submitted ? "profile.finishSetup" : "profile.setUpPayouts")} icon="card"
              style={{ marginTop: space.md }} onPress={() => tryIt(payouts.setUp)} loading={payouts.busy} />
          </>
        )}
      </Card>

      {role === "admin" && (
        <>
          <Text style={[type.label, { marginTop: space.xl, marginBottom: space.sm }]}>{t("profile.admin")}</Text>
          <View style={{ gap: space.sm }}>
            <Button title={t("profile.reports")} icon="flag" variant="secondary" onPress={() => router.push("/reports")} />
            <Button title={t("profile.manageUsers")} icon="people" variant="secondary" onPress={() => router.push("/admin")} />
          </View>
        </>
      )}

      <Text style={[type.label, { marginTop: space.xl, marginBottom: space.sm }]}>{t("profile.account")}</Text>
      <Card style={{ paddingVertical: 0 }}>
        {([
          [t("profile.language"), "language", pickLanguage, languages.find((l) => l.code === langChoice())?.name ?? t("profile.languageSystem")],
          [t("profile.blocked"), "ban", () => router.push("/blocked")],
          [t("profile.help"), "help-circle", () => openLegal("support")],
          [t("profile.terms"), "document-text", () => openLegal("terms")],
          [t("profile.privacy"), "lock-closed", () => openLegal("privacy")],
        ] as const).map(([label, icon, onPress, value], i) => (
          <Pressable key={label} onPress={onPress} style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", paddingVertical: 14, opacity: pressed ? 0.6 : 1,
            borderTopWidth: i ? 1 : 0, borderTopColor: colors.border })}>
            <Ionicons name={icon} size={20} color={colors.muted} />
            <Text style={[type.body, { flex: 1, marginLeft: space.md }]}>{label}</Text>
            {value ? <Text style={[type.small, { marginRight: 6 }]}>{value}</Text> : null}
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        <Button title={t("profile.signOut")} variant="secondary" onPress={() =>
          Alert.alert(t("profile.signOutTitle"), undefined, [{ text: t("common.cancel"), style: "cancel" }, { text: t("profile.signOut"), onPress: signOut }])} />
        <Button title={t("profile.deleteAccount")} variant="danger" loading={deleting} onPress={confirmDelete} />
      </View>
        </ScrollView>
  );
}
