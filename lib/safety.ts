import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { showSheet } from "../components/ActionSheet";
import { callFunction, supabase } from "./supabase";

// The public pages in site/ (privacy policy, terms, support, account deletion).
const SITE = (process.env.EXPO_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
export const openLegal = (page: "privacy" | "terms" | "support" | "delete-account") =>
  SITE ? WebBrowser.openBrowserAsync(`${SITE}/${page}.html`)
       : Alert.alert("Not available yet", "Set EXPO_PUBLIC_SITE_URL to the address of the Kickoff website.");

const REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech" },
  { value: "sexual", label: "Sexual or violent content" },
  { value: "spam", label: "Spam or scam" },
  { value: "other", label: "Something else" },
] as const;

/** Asks why, then files a report about a message or (without messageId) a user. */
export function report(target: { userId: string; messageId?: string }) {
  showSheet({
    title: target.messageId ? "Report message" : "Report user",
    message: "Why are you reporting this?",
    options: REASONS.map((r) => ({
      label: r.label,
      onPress: async () => {
        const { error } = await supabase.from("reports").insert({
          reported_user_id: target.userId, message_id: target.messageId ?? null, reason: r.value,
        });
        if (error) Alert.alert("Couldn't send report", error.message);
        else Alert.alert("Thanks for reporting", "Our team reviews every report within 24 hours. You can also block this person.");
      },
    })),
  });
}

/** Hides everything this person posts from you. Resolves true if they were blocked. */
export function block(user: { id: string; name: string }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(`Block ${user.name}?`, "You won't see their messages. You can unblock them on the Me tab.", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Block", style: "destructive", onPress: async () => {
        const { error } = await supabase.from("blocks").insert({ blocked_id: user.id });
        if (error && error.code !== "23505") { Alert.alert("Couldn't block", error.message); resolve(false); }
        else resolve(true);
      } },
    ]);
  });
}

export async function unblock(userId: string) {
  const { error } = await supabase.from("blocks").delete().eq("blocked_id", userId);
  if (error) throw error;
}

/** Deletes your own account, or as an admin, someone else's. */
export const deleteAccount = (userId?: string) => callFunction<{ deleted: true }>("delete-account", userId ? { userId } : {});
