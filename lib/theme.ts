import { Appearance } from "react-native";

export type Scheme = "light" | "dark";

const dark = {
  bg: "#0B0F0D",
  surface: "#141A17",
  surfaceHi: "#1C2420",
  border: "#26302B",
  text: "#F4F7F5",
  muted: "#8A9A92",
  accent: "#C6F432",       // pitch-lime
  accentInk: "#0B0F0D",
  success: "#3DDC84",
  warning: "#FFB347",
  danger: "#FF6B6B",
};

// Lime is unreadable as text on white, so light mode uses a deeper pitch green for accents.
const light: typeof dark = {
  bg: "#F4F6F3",
  surface: "#FFFFFF",
  surfaceHi: "#EBEFEA",
  border: "#DCE3DC",
  text: "#0E1411",
  muted: "#5E6D65",
  accent: "#4A7A00",
  accentInk: "#FFFFFF",
  success: "#17834A",
  warning: "#A35F00",
  danger: "#D23636",
};

/** The current palette. Its values change in place when the theme switches; see AppearanceProvider. */
export const colors = { ...dark };

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const type = {
  display: { fontSize: 34, fontWeight: "800" as const, letterSpacing: -0.8, color: colors.text },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.8, color: colors.muted, textTransform: "uppercase" as const },
};

let current: Scheme = "dark";
let version = 0;
export const scheme = () => current;

/** Switches the palette. Screens pick it up when they render again. */
export function applyTheme(s: Scheme) {
  if (s === current) return;
  current = s;
  version++;
  Object.assign(colors, s === "light" ? light : dark);
  type.display.color = type.title.color = type.body.color = colors.text;
  type.small.color = type.label.color = colors.muted;
}

/** A stylesheet built from the palette, rebuilt after the theme switches. Use as `styles().card`. */
export function themed<T>(make: () => T): () => T {
  let built: T | undefined;
  let builtFor = -1;
  return () => {
    if (builtFor !== version) { built = make(); builtFor = version; }
    return built!;
  };
}

// start in the phone's theme, so a light-mode phone doesn't flash dark while the saved choice loads
applyTheme(Appearance.getColorScheme() === "light" ? "light" : "dark");
