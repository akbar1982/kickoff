import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Chip, PlayerMeter } from "../../../components/ui";
import { freshChannel, supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { formatPrice, formatWhen, headcountLabel, isPast } from "../../../lib/hooks";
import { colors, radius, space, type } from "../../../lib/theme";
import { column, widths } from "../../../lib/layout";
import type { Match, Poll, Rsvp } from "../../../lib/types";
import { t } from "../../../lib/i18n";

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, role } = useAuth();
  const me = session?.user.id;

  const [match, setMatch] = useState<Match | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [tally, setTally] = useState<Record<string, number>>({});       // option_id -> votes
  const [myVotes, setMyVotes] = useState<Record<string, string>>({});   // poll_id -> option_id
  const [busy, setBusy] = useState(false);
  const [groupOrganizer, setGroupOrganizer] = useState(false);

  const load = useCallback(async () => {
    const [m, r, p, t, v] = await Promise.all([
      supabase.from("match_overview").select("*").eq("id", id).single(),
      supabase.from("rsvps").select("user_id,status,paid_at,profiles(display_name,avatar_url)").eq("match_id", id).order("created_at"),
      supabase.from("polls").select("*, poll_options(*)").eq("match_id", id).order("created_at"),
      supabase.from("poll_results").select("option_id,vote_count"),
      supabase.from("votes").select("poll_id,option_id").eq("user_id", me ?? ""),
    ]);
    if (m.data) {
      setMatch(m.data as Match);
      const gid = (m.data as Match).group_id;
      if (gid) {
        const { data: gm } = await supabase.from("group_members").select("role")
          .eq("group_id", gid).eq("user_id", me ?? "").eq("status", "active").maybeSingle();
        setGroupOrganizer(gm?.role === "organizer");
      }
    }
    if (r.data) setRsvps(r.data as unknown as Rsvp[]);
    if (p.data) setPolls(p.data as Poll[]);
    if (t.data) setTally(Object.fromEntries(t.data.map((x: any) => [x.option_id, Number(x.vote_count)])));
    if (v.data) setMyVotes(Object.fromEntries(v.data.map((x: any) => [x.poll_id, x.option_id])));
  }, [id, me]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // live updates for votes and roster
  useEffect(() => {
    const ch = freshChannel(`match-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps", filter: `match_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  const myRsvp = rsvps.find((r) => r.user_id === me);
  const isHost = match?.host_id === me;
  const isAdmin = role === "admin";
  const canManage = isHost || isAdmin || groupOrganizer;
  const canChat = isHost || isAdmin || !!myRsvp;
  const going = rsvps.filter((r) => r.status === "going");
  const waitlist = rsvps.filter((r) => r.status === "waitlist");
  // Players pay the organizer themselves (Venmo, Zelle, cash); organizers mark who has paid.
  const direct = !!match && match.price_cents > 0 && match.payment_method === "direct";

  const join = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("join_match", { p_match: id });
    setBusy(false);
    if (error) { Alert.alert(t("game.couldntJoin"), error.message); return; }
    await load();
    if (data === "pending_payment") router.push({ pathname: "/match/[id]/checkout", params: { id } });
    else if (data === "waitlist") Alert.alert(t("game.waitlisted"), t("game.waitlistedBody"));
    else if (data === "going" && direct) Alert.alert(t("game.youreIn"), t("game.payOrganizer", { price: formatPrice(match!.price_cents, match!.currency), instructions: match!.payment_instructions ?? "" }));
  };

  const leave = () => {
    Alert.alert(t("game.leaveTitle"), myRsvp?.status === "going" && match && match.price_cents > 0
      ? t(direct ? "game.leaveDirect" : "game.leaveRefundHost")
      : t("game.leaveWaitlist"), [
      { text: t("game.stay"), style: "cancel" },
      { text: t("game.leave"), style: "destructive", onPress: async () => {
        const { error } = await supabase.rpc("leave_match", { p_match: id });
        if (error) Alert.alert(t("game.couldntLeave"), error.message); else load();
      } },
    ]);
  };

  const playerActions = (r: Rsvp) => {
    if (!canManage || r.user_id === match?.host_id) return;
    const who = r.profiles?.display_name ?? t("common.player");
    const rpc = async (fn: string, args: Record<string, unknown>) => {
      const { error } = await supabase.rpc(fn, { p_match: id, p_user: r.user_id, ...args });
      if (error) Alert.alert(t("common.somethingWrong"), error.message); else load();
    };
    Alert.alert(who, undefined, [
      ...(direct ? [r.paid_at
        ? { text: t("game.markUnpaid"), onPress: () => rpc("set_player_paid", { p_paid: false }) }
        : { text: t("game.markPaid"), onPress: () => rpc("set_player_paid", { p_paid: true }) }] : []),
      { text: t("game.removeFromGame"), style: "destructive" as const, onPress: () => Alert.alert(t("game.removeTitle", { name: who }),
        match!.price_cents > 0 && r.paid_at
          ? t(direct ? "game.removeDirect" : "game.removeStripe")
          : t("game.removeFree"), [
        { text: t("common.keep"), style: "cancel" },
        { text: t("common.remove"), style: "destructive", onPress: () => rpc("remove_player", {}) },
      ]) },
      { text: t("common.cancel"), style: "cancel" as const },
    ]);
  };

  const cancelMatch = () => {
    Alert.alert(t("game.cancelTitle"), t("game.cancelBody"), [
      { text: t("common.keepIt"), style: "cancel" },
      { text: t("game.cancelGame"), style: "destructive", onPress: async () => {
        const { error } = await supabase.from("matches").update({ status: "cancelled" }).eq("id", id);
        if (error) Alert.alert(t("game.couldntCancel"), error.message); else load();
      } },
    ]);
  };

  const vote = async (pollId: string, optionId: string) => {
    if (myRsvp?.status !== "going") { Alert.alert(t("game.joinFirst"), t("game.joinFirstBody")); return; }
    const { error } = await supabase.from("votes").upsert({ poll_id: pollId, option_id: optionId, user_id: me });
    if (error) Alert.alert(t("game.couldntVote"), error.message); else load();
  };

  const openDirections = () => {
    if (!match) return;
    const label = encodeURIComponent(match.venue_name);
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${match.lat},${match.lng}&q=${label}`,
      default: `geo:${match.lat},${match.lng}?q=${match.lat},${match.lng}(${label})`,
    })!;
    Linking.openURL(url);
  };

  const cta = useMemo(() => {
    if (!match || match.status !== "open" || isPast(match)) return null;
    if (isHost) return null;
    if (!myRsvp) return { title: match.spots_left === 0 ? t("game.joinWaitlist") : match.price_cents > 0 ? t("game.joinPaid", { price: formatPrice(match.price_cents, match.currency) }) : t("game.joinGame"), onPress: join };
    if (myRsvp.status === "pending_payment") return { title: t("game.completePayment"), onPress: () => router.push({ pathname: "/match/[id]/checkout", params: { id } }) };
    return null;
  }, [match, myRsvp, isHost]);

  if (!match) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const head = headcountLabel(match);
  const cancelled = match.status === "cancelled";
  const ended = isPast(match);
  const open = match.status === "open" && !ended;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[{ padding: space.md, paddingBottom: 140 }, column(widths.page)]}>
        {cancelled && <View style={{ marginBottom: space.md }}><Chip label={t("game.wasCancelled")} tone="warn" icon="close-circle" /></View>}
        {ended && !cancelled && <View style={{ marginBottom: space.md }}><Chip label={t("game.wasPlayed")} icon="time" /></View>}
        <Text style={type.small}>{formatWhen(match.starts_at)} · {t("common.minutes", { n: match.duration_min })}</Text>
        <Text style={[type.display, { fontSize: 30, marginTop: 4 }]}>{match.title}</Text>
        <Text style={[type.small, { marginTop: 4 }]}>
          {t("game.hostedBy", { name: match.host_name })}
          {match.group_id && match.group_name ? (
            <Text style={{ color: colors.accent, fontWeight: "700" }}
              onPress={() => router.push({ pathname: "/group/[id]", params: { id: match.group_id! } })}> · {match.group_name}</Text>
          ) : null}
        </Text>
        {match.visibility === "group" && <View style={{ flexDirection: "row", marginTop: space.sm }}><Chip label={t("game.groupOnly")} icon="lock-closed" /></View>}

        <Card style={{ marginTop: space.lg }}>
          <PlayerMeter going={match.going_count} min={match.min_players} max={match.max_players} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.md }}>
            <Chip label={head.text} tone={head.tone} icon={match.is_confirmed ? "checkmark-circle" : "people"} />
            <Chip label={formatPrice(match.price_cents, match.currency)} tone={match.price_cents > 0 ? "neutral" : "good"} icon="pricetag" />
          </View>
          {!match.is_confirmed && (
            <Text style={[type.small, { marginTop: space.sm }]}>
              {t("game.goesAhead", { count: match.min_players })}
            </Text>
          )}
        </Card>

        {direct && myRsvp?.status === "going" && !isHost && (
          <Card style={{ marginTop: space.md, borderColor: myRsvp.paid_at ? colors.border : colors.warning }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={type.label}>{t("game.howToPay")}</Text>
              <Chip label={t(myRsvp.paid_at ? "common.paid" : "common.paymentDue")} tone={myRsvp.paid_at ? "good" : "warn"}
                icon={myRsvp.paid_at ? "checkmark-circle" : "time"} />
            </View>
            <Text style={[type.body, { marginTop: space.sm }]} selectable>{match.payment_instructions}</Text>
            {!myRsvp.paid_at && (
              <Text style={[type.small, { marginTop: space.sm }]}>
                {t("game.payHint", { price: formatPrice(match.price_cents, match.currency) })}
              </Text>
            )}
          </Card>
        )}

        <Pressable onPress={openDirections}>
          <Card style={{ marginTop: space.md, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="location" size={22} color={colors.accent} />
            <View style={{ flex: 1, marginLeft: space.sm }}>
              <Text style={type.body}>{match.venue_name}</Text>
              {match.address ? <Text style={type.small}>{match.address}</Text> : null}
            </View>
            <Ionicons name="navigate-outline" size={20} color={colors.muted} />
          </Card>
        </Pressable>

        {match.description ? (
          <Card style={{ marginTop: space.md }}><Text style={type.body}>{match.description}</Text></Card>
        ) : null}

        {canChat && (
          <Pressable onPress={() => router.push({ pathname: "/match/[id]/chat", params: { id } })}>
            <Card style={{ marginTop: space.md, flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="chatbubbles" size={22} color={colors.accent} />
              <Text style={[type.body, { flex: 1, marginLeft: space.sm }]}>{t("game.chat")}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Card>
          </Pressable>
        )}

        {/* ── Votes ── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm }}>
          <Text style={type.title}>{t("game.votes")}</Text>
          {(isHost || myRsvp?.status === "going") && open && (
            <Pressable onPress={() => router.push({ pathname: "/match/[id]/new-poll", params: { id } })} hitSlop={10}>
              <Text style={{ color: colors.accent, fontWeight: "700" }}>{t("game.newVote")}</Text>
            </Pressable>
          )}
        </View>
        {polls.length === 0 && <Text style={type.small}>{t("game.noVotes")}</Text>}
        {polls.map((poll) => {
          const total = poll.poll_options.reduce((s, o) => s + (tally[o.id] ?? 0), 0);
          const closed = poll.closes_at ? new Date(poll.closes_at) < new Date() : false;
          const topVotes = Math.max(0, ...poll.poll_options.map((o) => tally[o.id] ?? 0));
          return (
            <Card key={poll.id} style={{ marginBottom: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm }}>
                <Ionicons name={poll.kind === "time" ? "time-outline" : "location-outline"} size={16} color={colors.muted} />
                <Text style={[type.label, { marginLeft: 6 }]}>{t(poll.kind === "time" ? "game.voteTime" : "game.votePlace")}{closed ? t("game.voteClosed") : ""}</Text>
              </View>
              <Text style={[type.body, { fontWeight: "700", marginBottom: space.sm }]}>{poll.question}</Text>
              {poll.poll_options.map((o) => {
                const n = tally[o.id] ?? 0;
                const pct = total ? (n / total) * 100 : 0;
                const mine = myVotes[poll.id] === o.id;
                const leading = n > 0 && n === topVotes;
                return (
                  <Pressable key={o.id} disabled={closed || cancelled} onPress={() => vote(poll.id, o.id)}
                    style={{
                      marginTop: 8, borderRadius: radius.md, overflow: "hidden", borderWidth: 1,
                      borderColor: mine ? colors.accent : colors.border, backgroundColor: colors.surfaceHi,
                    }}>
                    <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
                      backgroundColor: leading ? "rgba(198,244,50,0.22)" : "rgba(255,255,255,0.06)" }} />
                    <View style={{ flexDirection: "row", alignItems: "center", padding: 14 }}>
                      <Ionicons name={mine ? "radio-button-on" : "radio-button-off"} size={18} color={mine ? colors.accent : colors.muted} />
                      <Text style={[type.body, { flex: 1, marginLeft: 10 }]} numberOfLines={2}>{o.label}</Text>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{n}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <Text style={[type.small, { marginTop: space.sm }]}>{t("game.voteCount", { count: total })}</Text>
            </Card>
          );
        })}

        {/* ── Roster ── */}
        <Text style={[type.title, { marginTop: space.xl, marginBottom: space.sm }]}>{t("game.players", { going: going.length, max: match.max_players })}</Text>
        <Card>
          {going.map((r, i) => (
            <Pressable key={r.user_id} onPress={() => playerActions(r)} disabled={!canManage || r.user_id === match.host_id}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8,
              borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{(r.profiles?.display_name ?? "?").slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={[type.body, { marginLeft: 10, flex: 1 }]}>{r.profiles?.display_name ?? t("common.player")}{r.user_id === me ? ` ${t("common.you")}` : ""}</Text>
              {r.user_id === match.host_id && <Chip label={t("game.host")} tone="accent" />}
              {direct && canManage && r.user_id !== match.host_id && (
                <Chip label={t(r.paid_at ? "common.paid" : "common.unpaid")} tone={r.paid_at ? "good" : "warn"} />
              )}
              {canManage && r.user_id !== match.host_id && (
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} style={{ marginLeft: 8 }} />
              )}
            </Pressable>
          ))}
          {going.length === 0 && <Text style={type.small}>{t("game.nobody")}</Text>}
        </Card>
        {direct && canManage && (
          <Text style={[type.small, { marginTop: space.sm }]}>
            {t("game.unpaidHint", { count: going.filter((r) => r.user_id !== match.host_id && !r.paid_at).length })}
          </Text>
        )}
        {waitlist.length > 0 && (
          <Text style={[type.small, { marginTop: space.sm }]}>
            {t("game.waitlist", { names: waitlist.map((r) => r.profiles?.display_name ?? t("common.player")).join(", ") })}
          </Text>
        )}

        {/* ── Secondary actions ── */}
        <View style={{ marginTop: space.xl }}>
          {myRsvp && !isHost && open && <Button title={t("game.leaveGame")} variant="danger" onPress={leave} />}
          {canManage && open && <Button title={t("game.cancelGame")} variant="danger" onPress={cancelMatch} />}
        </View>
      </ScrollView>

      {cta && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: space.md, paddingBottom: space.lg,
          backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button title={cta.title} onPress={cta.onPress} loading={busy} style={column(widths.form)} />
        </View>
      )}
    </View>
  );
}
