import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

// Session tokens live in the device keychain / keystore, not plain storage.
const storage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } },
);

let channelSeq = 0;
/**
 * A realtime channel with a name no other channel has used. supabase.channel() returns an existing
 * channel with the same name, and removeChannel() only drops it once the server confirms, so a
 * screen that re-subscribes right after cleaning up (e.g. when it becomes visible again) would get
 * the old, already-subscribed channel back and crash when adding listeners.
 */
export const freshChannel = (name: string) => supabase.channel(`${name}-${++channelSeq}`);

/** Calls an edge function and throws the server's own error message on failure. */
export async function callFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // supabase-js hides the JSON body on non-2xx; try to surface the server's message
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error ?? msg; } catch {}
    throw new Error(msg);
  }
  return data as T;
}
