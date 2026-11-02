import React, { createContext, useContext, useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Role } from "./types";

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  session: Session | null;
  loading: boolean;
  role: Role | null;            // null until the profile has loaded
  signInWithProvider: (p: "google") => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    setRole(null);
    if (!userId) return;
    supabase.from("profiles").select("role").eq("id", userId).single()
      .then(({ data }) => setRole((data?.role as Role) ?? "participant"));
  }, [userId]);

  const signInWithProvider: AuthState["signInWithProvider"] = async (provider) => {
    const redirectTo = Linking.createURL("auth-callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error("Could not start sign-in");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return; // user closed the browser

    // Supabase returns tokens in the URL fragment: kickoff://auth-callback#access_token=...
    const params = new URLSearchParams(result.url.split("#")[1] ?? "");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) throw new Error("Sign-in did not return a session");
    const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setErr) throw setErr;
  };

  // Native Sign in with Apple (iOS). Supabase checks Apple's token against the hash of this nonce.
  const signInWithApple = async () => {
    const nonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    let cred: AppleAuthentication.AppleAuthenticationCredential;
    try {
      cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashed,
      });
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      throw e;
    }
    if (!cred.identityToken) throw new Error("Apple didn't return a sign-in token");
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce });
    if (error) throw error;

    // Apple only shares the name on the very first sign-in, so save it then.
    const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(" ");
    if (fullName && data.user) {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      await supabase.from("profiles").update({ display_name: fullName }).eq("id", data.user.id);
    }
  };

  const signInWithEmail: AuthState["signInWithEmail"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  };

  const signUpWithEmail: AuthState["signUpWithEmail"] = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, loading, role, signInWithProvider, signInWithApple, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
