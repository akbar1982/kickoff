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
    if (error) { Alert.alert("Couldn't join", error.message); return; }
    await load();
    if (data === "pending_payment") router.push({ pathname: "/match/[id]/checkout", params: { id } });
    else if (data === "waitlist") Alert.alert("You're on the waitlist", "This game is full. We'll move you in automatically if a spot opens up.");
    else if (data === "going" && direct) Alert.alert("You're in!", `Pay ${formatPrice(match!.price_cents, match!.currency)} to the organizer:\n\n${match!.payment_instructions}`);
  };

  const leave = () => {
    Alert.alert("Leave this game?", myRsvp?.status === "going" && match && match.price_cents > 0
      ? (direct ? "If you've already paid, sort out a refund with the organizer." : "Refunds are handled by the host.")
      : "Your spot will go to the next person on the waitlist.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: async () => {
        const { error } = await supabase.rpc("leave_match", { p_match: id });
        if (error) Alert.alert("Couldn't leave", error.message); else load();
      } },
    ]);
  };

  const playerActions = (r: Rsvp) => {
    if (!canManage || r.user_id === match?.host_id) return;
    const who = r.profiles?.display_name ?? "Player";
    const rpc = async (fn: string, args: Record<string, unknown>) => {
      const { error } = await supabase.rpc(fn, { p_match: id, p_user: r.user_id, ...args });
      if (error) Alert.alert("Something went wrong", error.message); else load();
    };
    Alert.alert(who, undefined, [
      ...(direct ? [r.paid_at
        ? { text: "Mark as not paid", onPress: () => rpc("set_player_paid", { p_paid: false }) }
        : { text: "Mark as paid", onPress: () => rpc("set_player_paid", { p_paid: true }) }] : []),
      { text: "Remove from game", style: "destructive" as const, onPress: () => Alert.alert(`Remove ${who}?`,
        match!.price_cents > 0 && r.paid_at
          ? (direct ? "Their spot goes to the waitlist. Refund them yourself if needed." : "Their spot goes to the waitlist. Refund them from your Stripe dashboard.")
          : "Their spot goes to the next person on the waitlist.", [
        { text: "Keep", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => rpc("remove_player", {}) },
      ]) },
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const cancelMatch = () => {
    Alert.alert("Cancel this game?", "Everyone who joined will see it as cancelled.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel game", style: "destructive", onPress: async () => {
        const { error } = await supabase.from("matches").update({ status: "cancelled" }).eq("id", id);
        if (error) Alert.alert("Couldn't cancel", error.message); else load();
      } },
    ]);
  };

  const vote = async (pollId: string, optionId: string) => {
    if (myRsvp?.status !== "going") { Alert.alert("Join first", "Only players who are going can vote."); return; }
    const { error } = await supabase.from("votes").upsert({ poll_id: pollId, option_id: optionId, user_id: me });
    if (error) Alert.alert("Couldn't vote", error.message); else load();
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
    if (!myRsvp) return { title: match.spots_left === 0 ? "Join waitlist" : match.price_cents > 0 ? `Join · ${formatPrice(match.price_cents, match.currency)}` : "Join game", onPress: join };
    if (myRsvp.status === "pending_payment") return { title: "Complete payment", onPress: () => router.push({ pathname: "/match/[id]/checkout", params: { id } }) };
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
        {cancelled && <View style={{ marginBottom: space.md }}><Chip label="This game was cancelled" tone="warn" icon="close-circle" /></View>}
        {ended && !cancelled && <View style={{ marginBottom: space.md }}><Chip label="This game has been played" icon="time" /></View>}
        <Text style={type.small}>{formatWhen(match.starts_at)} · {match.duration_min} min</Text>
        <Text style={[type.display, { fontSize: 30, marginTop: 4 }]}>{match.title}</Text>
        <Text style={[type.small, { marginTop: 4 }]}>
          Hosted by {match.host_name}
          {match.group_id && match.group_name ? (
            <Text style={{ color: colors.accent, fontWeight: "700" }}
              onPress={() => router.push({ pathname: "/group/[id]", params: { id: match.group_id! } })}> · {match.group_name}</Text>
          ) : null}
        </Text>
        {match.visibility === "group" && <View style={{ flexDirection: "row", marginTop: space.sm }}><Chip label="Group members only" icon="lock-closed" /></View>}

        <Card style={{ marginTop: space.lg }}>
          <PlayerMeter going={match.going_count} min={match.min_players} max={match.max_players} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.md }}>
            <Chip label={head.text} tone={head.tone} icon={match.is_confirmed ? "checkmark-circle" : "people"} />
            <Chip label={formatPrice(match.price_cents, match.currency)} tone={match.price_cents > 0 ? "neutral" : "good"} icon="pricetag" />
          </View>
          {!match.is_confirmed && (
            <Text style={[type.small, { marginTop: space.sm }]}>
              The game goes ahead once {match.min_players} players have joined.
            </Text>
          )}
        </Card>

        {direct && myRsvp?.status === "going" && !isHost && (
          <Card style={{ marginTop: space.md, borderColor: myRsvp.paid_at ? colors.border : colors.warning }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={type.label}>How to pay</Text>
              <Chip label={myRsvp.paid_at ? "Paid" : "Payment due"} tone={myRsvp.paid_at ? "good" : "warn"}
                icon={myRsvp.paid_at ? "checkmark-circle" : "time"} />
            </View>
            <Text style={[type.body, { marginTop: space.sm }]} selectable>{match.payment_instructions}</Text>
            {!myRsvp.paid_at && (
              <Text style={[type.small, { marginTop: space.sm }]}>
                Pay {formatPrice(match.price_cents, match.currency)} to the organizer. They'll mark you as paid.
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
              <Text style={[type.body, { flex: 1, marginLeft: space.sm }]}>Game chat</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Card>
          </Pressable>
        )}

        {/* ── Votes ── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm }}>
          <Text style={type.title}>Votes</Text>
          {(isHost || myRsvp?.status === "going") && open && (
            <Pressable onPress={() => router.push({ pathname: "/match/[id]/new-poll", params: { id } })} hitSlop={10}>
              <Text style={{ color: colors.accent, fontWeight: "700" }}>+ New vote</Text>
            </Pressable>
          )}
        </View>
        {polls.length === 0 && <Text style={type.small}>No votes yet. Ask the group to pick a time or a spot.</Text>}
        {polls.map((poll) => {
          const total = poll.poll_options.reduce((s, o) => s + (tally[o.id] ?? 0), 0);
          const closed = poll.closes_at ? new Date(poll.closes_at) < new Date() : false;
          const topVotes = Math.max(0, ...poll.poll_options.map((o) => tally[o.id] ?? 0));
          return (
            <Card key={poll.id} style={{ marginBottom: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.sm }}>
                <Ionicons name={poll.kind === "time" ? "time-outline" : "location-outline"} size={16} color={colors.muted} />
                <Text style={[type.label, { marginLeft: 6 }]}>{poll.kind === "time" ? "Time" : "Location"}{closed ? " · closed" : ""}</Text>
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
              <Text style={[type.small, { marginTop: space.sm }]}>{total} vote{total === 1 ? "" : "s"}</Text>
            </Card>
          );
        })}

        {/* ── Roster ── */}
        <Text style={[type.title, { marginTop: space.xl, marginBottom: space.sm }]}>Players ({going.length}/{match.max_players})</Text>
        <Card>
          {going.map((r, i) => (
            <Pressable key={r.user_id} onPress={() => playerActions(r)} disabled={!canManage || r.user_id === match.host_id}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8,
              borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{(r.profiles?.display_name ?? "?").slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={[type.body, { marginLeft: 10, flex: 1 }]}>{r.profiles?.display_name ?? "Player"}{r.user_id === me ? " (you)" : ""}</Text>
              {r.user_id === match.host_id && <Chip label="Host" tone="accent" />}
              {direct && canManage && r.user_id !== match.host_id && (
                <Chip label={r.paid_at ? "Paid" : "Unpaid"} tone={r.paid_at ? "good" : "warn"} />
              )}
              {canManage && r.user_id !== match.host_id && (
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} style={{ marginLeft: 8 }} />
              )}
            </Pressable>
          ))}
          {going.length === 0 && <Text style={type.small}>Nobody yet.</Text>}
        </Card>
        {direct && canManage && (
          <Text style={[type.small, { marginTop: space.sm }]}>
            {going.filter((r) => r.user_id !== match.host_id && !r.paid_at).length} unpaid · tap a player to mark them paid or remove them.
          </Text>
        )}
        {waitlist.length > 0 && (
          <Text style={[type.small, { marginTop: space.sm }]}>
            Waitlist: {waitlist.map((r) => r.profiles?.display_name ?? "Player").join(", ")}
          </Text>
        )}

        {/* ── Secondary actions ── */}
        <View style={{ marginTop: space.xl }}>
          {myRsvp && !isHost && open && <Button title="Leave game" variant="danger" onPress={leave} />}
          {canManage && open && <Button title="Cancel game" variant="danger" onPress={cancelMatch} />}
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
