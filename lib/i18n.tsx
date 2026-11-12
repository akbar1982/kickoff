import React, { useEffect, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales, useLocales } from "expo-localization";
import en, { type Entry, type Key } from "../locales/en";
import es from "../locales/es";
import ko from "../locales/ko";
import ru from "../locales/ru";
import uz from "../locales/uz";
import zh from "../locales/zh";
import { colors } from "./theme";

export type Lang = "en" | "ru" | "uz" | "es" | "ko" | "zh";
const dicts: Record<Lang, Record<Key, Entry>> = { en, ru, uz, es, ko, zh };

/** Each language in its own name, in the order the picker lists them. */
export const languages: { code: Lang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "ru", name: "Русский" },
  { code: "uz", name: "Oʻzbekcha" },
  { code: "ko", name: "한국어" },
  { code: "zh", name: "简体中文" },
];

const STORAGE_KEY = "language";
const supported = (code?: string | null): code is Lang => !!code && code in dicts;

/** The phone's first language we have, else English. */
function systemLang(): Lang {
  for (const l of getLocales()) if (supported(l.languageCode)) return l.languageCode;
  return "en";
}

let current: Lang = systemLang();
let choice: Lang | null = null;   // null = follow the phone

export const lang = () => current;
export const langChoice = () => choice;

/** Locale for dates and numbers: the phone's own tag when it's in the same language (keeps its region), else the bare language. */
export function localeTag() {
  const device = getLocales().find((l) => l.languageCode === current);
  if (device) return device.languageTag;
  return current === "zh" ? "zh-Hans" : current;
}

// CLDR plural categories for the languages we ship.
function plural(n: number): "one" | "few" | "many" | "other" {
  if (current === "ru") {
    const d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return "one";
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "few";
    return "many";
  }
  if (current === "ko" || current === "zh") return "other";
  return n === 1 ? "one" : "other";
}

/** Translated text for `key`. `{name}` placeholders are filled from `params`; `count` also picks the plural form. */
export function t(key: Key, params?: Record<string, string | number>): string {
  let entry = dicts[current][key] ?? en[key];
  if (typeof entry !== "string") {
    const forms = entry;
    entry = forms[plural(Number(params?.count ?? 0))] ?? forms.other;
  }
  return params ? entry.replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m)) : entry;
}

let changeListener: ((l: Lang | null) => void) | null = null;

/** Switches language (null = follow the phone) and remembers it on this device. */
export async function setLanguage(l: Lang | null) {
  try {
    if (l) await AsyncStorage.setItem(STORAGE_KEY, l);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
  changeListener?.(l);
}

/** Loads the saved choice, then re-renders the whole app whenever the language changes. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<Lang | null>(null);
  const deviceLocales = useLocales();   // updates when the phone's language changes while the app is open

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (supported(v)) setPicked(v); })
      .catch(() => {})
      .finally(() => setReady(true));
    changeListener = setPicked;
    return () => { changeListener = null; };
  }, []);

  choice = picked;
  current = picked ?? systemLang();
  const key = `${current}-${deviceLocales[0]?.languageTag}`;

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  // keyed remount: every screen renders again with the new strings
  return <React.Fragment key={key}>{children}</React.Fragment>;
}
