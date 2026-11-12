import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { showSheet } from "../components/ActionSheet";
import { callFunction, supabase } from "./supabase";
import { t } from "./i18n";

// The public pages in site/ (privacy policy, terms, support, account deletion).
const SITE = (process.env.EXPO_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
export const openLegal = (page: "privacy" | "terms" | "support" | "delete-account") =>
  SITE ? WebBrowser.openBrowserAsync(`${SITE}/${page}.html`)
       : Alert.alert(t("common.notAvailable"), t("common.siteMissing"));

const REASONS = ["harassment", "hate", "sexual", "spam", "other"] as const;

/** Asks why, then files a report about a message or (without messageId) a user. */
export function report(target: { userId: string; messageId?: string }) {
  showSheet({
    title: t(target.messageId ? "chat.reportMessage" : "safety.reportUser"),
    message: t("safety.why"),
    options: REASONS.map((reason) => ({
      label: t(`safety.${reason}`),
      onPress: async () => {
        const { error } = await supabase.from("reports").insert({
          reported_user_id: target.userId, message_id: target.messageId ?? null, reason,
        });
        if (error) Alert.alert(t("safety.reportFailed"), error.message);
        else Alert.alert(t("safety.thanks"), t("safety.thanksBody"));
      },
    })),
  });
}

/** Hides everything this person posts from you. Resolves true if they were blocked. */
export function block(user: { id: string; name: string }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(t("safety.blockTitle", { name: user.name }), t("safety.blockBody"), [
      { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: t("safety.block"), style: "destructive", onPress: async () => {
        const { error } = await supabase.from("blocks").insert({ blocked_id: user.id });
        if (error && error.code !== "23505") { Alert.alert(t("safety.blockFailed"), error.message); resolve(false); }
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
