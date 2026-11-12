import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { freshChannel, supabase } from "./supabase";
import type { Match } from "./types";
import { localeTag, t } from "./i18n";

export type Coords = { lat: number; lng: number };
const DAY_MS = 24 * 60 * 60 * 1000;

/** A game counts as past once it has started. Everyone sees it greyed out for a day;
 *  after that only its organizer does, for 30 days (enforced by the database). */
export const isPast = (m: { starts_at: string }) => +new Date(m.starts_at) <= Date.now();

/** Upcoming games soonest first, then past games most recent first. */
export function upcomingThenPast<T extends { starts_at: string }>(list: T[]) {
  const upcoming = list.filter((m) => !isPast(m));
  const past = list.filter(isPast).sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  return { upcoming, past };
}

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

// ───────────── Distance and search radius ─────────────
const KM_PER_MI = 1.609344;

/** Miles on phones set to US measurements, kilometres everywhere else. */
export const usesMiles = () => getLocales()[0]?.measurementSystem === "us";

export function formatDistance(km: number) {
  const miles = usesMiles();
  const n = miles ? km / KM_PER_MI : km;
  const shown = n < 10 ? n.toFixed(1) : Math.round(n);
  return miles ? t("common.mi", { n: shown, count: Number(shown) }) : t("common.km", { n: shown });
}

/** Radius choices in km, as round numbers in the phone's unit. null = anywhere. */
export const radiusChoices = (): (number | null)[] => usesMiles()
  ? [...[10, 25, 50, 100, 250, 500].map((mi) => mi * KM_PER_MI), null]
  : [10, 25, 50, 100, 150, 250, 500, null];

// One radius for the whole app (games and groups), remembered on this device.
const RADIUS_KEY = "radiusKm";
let radius: number | null = usesMiles() ? 100 * KM_PER_MI : 150;
let radiusLoad: Promise<void> | null = null;
const radiusListeners = new Set<(km: number | null) => void>();

export function setRadius(km: number | null) {
  radius = km;
  radiusListeners.forEach((l) => l(km));
  AsyncStorage.setItem(RADIUS_KEY, km === null ? "any" : String(km)).catch(() => {});
}

/** Current search radius in km (null = anywhere); updates everywhere when it changes. */
export function useRadius() {
  const [km, setKm] = useState(radius);
  useEffect(() => {
    radiusListeners.add(setKm);
    radiusLoad ??= AsyncStorage.getItem(RADIUS_KEY).then((v) => {
      if (!v) return;
      radius = v === "any" ? null : Number(v);
      radiusListeners.forEach((l) => l(radius));
    }).catch(() => {});
    setKm(radius);
    return () => { radiusListeners.delete(setKm); };
  }, []);
  return km;
}

export const radiusLabel = (km: number | null) =>
  km === null ? t("radius.anywhere") : t("radius.within", { distance: formatDistance(km) });

/** Open games from the last 30 days on; which past ones you get back depends on whether you host them. */
export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("match_overview")
      .select("*")
      .eq("status", "open")
      .gte("starts_at", new Date(Date.now() - 30 * DAY_MS).toISOString())
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
  const day = d.toLocaleDateString(localeTag(), { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(localeTag(), { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

export function formatPrice(cents: number, currency = "usd") {
  if (cents <= 0) return t("common.free");
  // whole amounts without ",00" (matters for so'm, where prices are in thousands)
  return new Intl.NumberFormat(localeTag(), { style: "currency", currency: currency.toUpperCase(),
    ...(cents % 100 === 0 && { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }).format(cents / 100);
}

/** Single place that decides how a match's headcount is described. */
export function headcountLabel(m: Pick<Match, "is_confirmed" | "spots_left" | "players_needed" | "waitlist_count">) {
  if (m.spots_left === 0) return { text: m.waitlist_count ? t("match.fullWaiting", { count: m.waitlist_count }) : t("match.full"), tone: "warn" as const };
  if (m.is_confirmed) return { text: t("match.confirmedLeft", { count: m.spots_left }), tone: "good" as const };
  return { text: t("match.needsMore", { count: m.players_needed }), tone: "accent" as const };
}
