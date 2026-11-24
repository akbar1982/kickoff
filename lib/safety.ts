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

/**
 * Asks why, then files a report about a message, a game or group (`about` describes it for the admins),
 * or just a user.
 */
export function report(target: { userId: string; messageId?: string; about?: string }) {
  showSheet({
    title: t(target.messageId ? "chat.reportMessage" : "safety.reportUser"),
    message: t("safety.why"),
    options: REASONS.map((reason) => ({
      label: t(`safety.${reason}`),
      onPress: async () => {
        const { error } = await supabase.from("reports").insert({
          reported_user_id: target.userId, message_id: target.messageId ?? null, message_body: target.about ?? null, reason,
        });
        if (error) Alert.alert(t("safety.reportFailed"), error.message);
        else Alert.alert(t("safety.thanks"), t("safety.thanksBody"));
      },
    })),
  });
}

const blockListeners = new Set<() => void>();
/** Runs `fn` whenever you block someone, so lists can drop their content. Returns the unsubscribe. */
export const onBlock = (fn: () => void) => { blockListeners.add(fn); return () => { blockListeners.delete(fn); }; };

/** The people you've blocked. */
export async function blockedIds() {
  const { data } = await supabase.from("blocks").select("blocked_id");
  return new Set((data ?? []).map((b) => b.blocked_id as string));
}

/**
 * Hides everything this person posts from you, and tells our admins (as a report on the message, when
 * blocked from one). Resolves true if they were blocked.
 */
export function block(user: { id: string; name: string }, messageId?: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(t("safety.blockTitle", { name: user.name }), t("safety.blockBody"), [
      { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: t("safety.block"), style: "destructive", onPress: async () => {
        const { error } = await supabase.from("blocks").insert({ blocked_id: user.id });
        if (error && error.code !== "23505") { Alert.alert(t("safety.blockFailed"), error.message); resolve(false); return; }
        await supabase.from("reports").insert({
          reported_user_id: user.id, message_id: messageId ?? null, message_body: messageId ? null : "[blocked]", reason: "other",
        });
        blockListeners.forEach((fn) => fn());
        resolve(true);
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
