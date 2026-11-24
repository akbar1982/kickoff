import React, { useEffect, useState } from "react";
import { Appearance, useColorScheme, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyTheme, colors, type Scheme } from "./theme";

const STORAGE_KEY = "appearance";
let choice: Scheme | null = null;   // null = follow the phone
let changeListener: ((s: Scheme | null) => void) | null = null;

export const appearanceChoice = () => choice;

/** Switches between light and dark (null = follow the phone) and remembers it on this device. */
export async function setAppearance(s: Scheme | null) {
  try {
    if (s) await AsyncStorage.setItem(STORAGE_KEY, s);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
  changeListener?.(s);
}

/** Loads the saved choice, then re-renders the whole app whenever the theme changes. */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<Scheme | null>(null);
  const phone = useColorScheme();   // updates when the phone switches, e.g. at sunset

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v === "light" || v === "dark") setPicked(v); })
      .catch(() => {})
      .finally(() => setReady(true));
    changeListener = setPicked;
    return () => { changeListener = null; };
  }, []);

  // native pieces (alerts, keyboard, date picker) follow the app's choice too
  useEffect(() => { Appearance.setColorScheme(picked ?? "unspecified"); }, [picked]);

  choice = picked;
  const current: Scheme = picked ?? (phone === "light" ? "light" : "dark");
  applyTheme(current);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  // keyed remount: every screen renders again with the new colors
  return <React.Fragment key={current}>{children}</React.Fragment>;
}
