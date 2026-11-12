import type { Place } from "./types";
import { t } from "./i18n";

const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "";

/**
 * Searches for venues (pitches, parks, sports centres) near a point using the
 * Google Places API (New) "Text Search". Results are biased to ~15 km around `near`.
 */
export async function searchPlaces(query: string, near: { lat: number; lng: number }): Promise<Place[]> {
  if (!query.trim() || !KEY) return [];
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 10,
      locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 15000 } },
    }),
  });
  if (!res.ok) throw new Error("Place search failed");
  const json = await res.json();
  return (json.places ?? []).map((p: any) => ({
    id: p.id,
    name: p.displayName?.text ?? t("common.unnamedPlace"),
    address: p.formattedAddress ?? "",
    lat: p.location.latitude,
    lng: p.location.longitude,
  }));
}

/** Turns a dropped pin into a readable address (uses the device geocoder, no API key needed). */
export async function describePin(lat: number, lng: number): Promise<{ name: string; address: string }> {
  const Location = await import("expo-location");
  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const street = [r?.streetNumber, r?.street].filter(Boolean).join(" ");
    return {
      name: r?.name || street || t("common.droppedPin"),
      address: [street, r?.city, r?.region].filter(Boolean).join(", "),
    };
  } catch {
    return { name: t("common.droppedPin"), address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
