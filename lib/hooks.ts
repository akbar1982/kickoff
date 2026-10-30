import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import { freshChannel, supabase } from "./supabase";
import type { Match } from "./types";

export type Coords = { lat: number; lng: number };
const FALLBACK: Coords = { lat: 40.2206, lng: -74.7597 }; // used until/unless location permission is granted

export function useUserLocation() {
  const [coords, setCoords] = useState<Coords>(FALLBACK);
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      setGranted(true);
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, []);
  return { coords, granted };
}

export function useUpcomingMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("match_overview")
      .select("*")
      .eq("status", "open")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });
    if (error) setError(error.message);
    else { setMatches(data as Match[]); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // keep spot counts live as people join / leave
    const ch = freshChannel("rsvps-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return { matches, loading, error, reload: load };
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

export function formatPrice(cents: number, currency = "usd") {
  if (cents <= 0) return "Free";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** Single place that decides how a match's headcount is described. */
export function headcountLabel(m: Pick<Match, "is_confirmed" | "spots_left" | "players_needed" | "waitlist_count">) {
  if (m.spots_left === 0) return { text: m.waitlist_count ? `Full · ${m.waitlist_count} waiting` : "Full", tone: "warn" as const };
  if (m.is_confirmed) return { text: `Confirmed · ${m.spots_left} spot${m.spots_left === 1 ? "" : "s"} left`, tone: "good" as const };
  return { text: `Needs ${m.players_needed} more to confirm`, tone: "accent" as const };
}
