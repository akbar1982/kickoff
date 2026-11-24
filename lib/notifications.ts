import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { supabase } from "./supabase";
import { lang } from "./i18n";

// The server (supabase/009_push.sql) sends every notification with data.url, the screen it opens.
type Data = { url?: string };

let openChat: string | null = null;   // url of the chat on screen; its own messages don't pop up
let token: string | null = null;      // this phone's Expo push token, once registered

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const show = (n.request.content.data as Data)?.url !== openChat;
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

/** ChatRoom calls this while it's on screen, and clears that chat's notifications. */
export function setOpenChat(url: string | null) {
  openChat = url;
  if (!url) return;
  Notifications.getPresentedNotificationsAsync().then((shown) => shown
    .filter((n) => (n.request.content.data as Data)?.url === url)
    .forEach((n) => Notifications.dismissNotificationAsync(n.request.identifier))).catch(() => {});
}

/** Asks for permission (once) and saves this phone's token for the signed-in user. */
async function register() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Kickoff", importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && canAskAgain) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc("register_push_token", { p_token: token, p_lang: lang() });
  if (error) throw error;
}

/** Stops this phone getting the user's notifications. Call before signing out, while still signed in. */
export async function unregisterPush() {
  if (token) await supabase.rpc("unregister_push_token", { p_token: token });
}

const open = (r: Notifications.NotificationResponse | null) => {
  const url = (r?.notification.request.content.data as Data)?.url;
  if (url) router.push(url as any);
};

/** Registers while signed in and opens the right screen when a notification is tapped. */
export function usePushNotifications(userId: string | undefined) {
  const language = lang();
  useEffect(() => {
    if (!userId) return;
    // no push on simulators without a device token, or Android builds without Firebase; the app works the same without it
    register().catch((e) => console.warn("Push notifications unavailable:", e?.message ?? e));
  }, [userId, language]);

  useEffect(() => {
    if (!userId) return;
    // the tap that launched the app, then any later ones
    Notifications.getLastNotificationResponseAsync().then((r) => {
      open(r);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    });
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [userId]);
}
