import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { Screen } from "../components/ui";

// On Android the sign-in and Stripe return links (kickoff://auth-callback, kickoff://payouts-return)
// also open as deep links. The browser session already handled them, so just step back to where we were.
export default function ReturnLink() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);
  return <Screen>{null}</Screen>;
}
